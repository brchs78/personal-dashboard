// OLE OS — VoiceMode: Vollbild-Voice-Overlay à la Claude
// State-Machine: listening → thinking → speaking → listening
// - Continuous webkitSpeechRecognition (de-DE), Auto-Restart bei onend
// - Silence-Timer 1.5s → auto-submit via coach.send
// - speechSynthesis TTS für jede neue Assistant-Message
// - Animierter Magenta-Indigo-Orb

import { useEffect, useRef, useState } from "react";
import tokens from "../styles/tokens";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff } from "lucide-react";

const SILENCE_MS = 1500;

const STATE_LABEL = {
    idle:      "...",
    listening: "Höre zu...",
    thinking:  "Denke nach...",
    speaking:  "Spreche...",
    paused:    "Pausiert",
    error:     "Fehler",
};

export default function VoiceMode({ coach, apiKey, onClose }) {
    const [vState, setVState] = useState("idle");
    const [live, setLive] = useState("");
    const [errMsg, setErrMsg] = useState("");

    const stateRef = useRef(vState);
    stateRef.current = vState;

    const recogRef = useRef(null);
    const finalAccRef = useRef("");
    const silenceTRef = useRef(null);
    const lastSpokenIdRef = useRef(-1);
    const utterRef = useRef(null);

    // ── STT setup ───────────────────────────────────────────────
    useEffect(() => {
        const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
        if (!SR) {
            setErrMsg("Spracheingabe nicht verfügbar");
            setVState("error");
            return;
        }
        const r = new SR();
        r.lang = "de-DE";
        r.continuous = true;
        r.interimResults = true;

        r.onresult = (e) => {
            if (stateRef.current !== "listening") return;
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalAccRef.current += t;
                else interim += t;
            }
            setLive(finalAccRef.current + interim);
            if (silenceTRef.current) clearTimeout(silenceTRef.current);
            if (finalAccRef.current.trim()) {
                silenceTRef.current = setTimeout(() => {
                    submit(finalAccRef.current.trim());
                }, SILENCE_MS);
            }
        };

        r.onerror = (e) => {
            if (e.error === "no-speech" || e.error === "aborted") return;
            if (e.error === "not-allowed") {
                setErrMsg("Mikro-Zugriff verweigert");
                setVState("error");
            } else if (e.error === "network") {
                setErrMsg("Keine Verbindung");
                setVState("error");
            }
        };

        r.onend = () => {
            // Auto-Restart solange wir hören wollen (Chromium killt nach ~60s)
            if (stateRef.current === "listening") {
                try { r.start(); } catch { /* noop */ }
            }
        };

        recogRef.current = r;
        // Start listening
        setVState("listening");
        try { r.start(); } catch { /* noop */ }

        return () => {
            if (silenceTRef.current) clearTimeout(silenceTRef.current);
            try { r.stop(); } catch { /* noop */ }
            try { window.speechSynthesis.cancel(); } catch { /* noop */ }
            recogRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── TTS auf neue Assistant-Message ──────────────────────────
    useEffect(() => {
        if (!coach.display.length) return;
        const last = coach.display[coach.display.length - 1];
        if (last.role !== "assistant" || !last.text) return;
        if (last.id <= lastSpokenIdRef.current) return;
        lastSpokenIdRef.current = last.id;
        speak(last.text);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coach.display.length]);

    function speak(text) {
        const synth = window.speechSynthesis;
        if (!synth) {
            setVState("listening");
            return;
        }
        // STT muss stoppen während TTS — sonst Echo-Loop
        setVState("speaking");
        try { recogRef.current?.stop(); } catch { /* noop */ }
        try { synth.cancel(); } catch { /* noop */ }

        const u = new SpeechSynthesisUtterance(text);
        u.lang = "de-DE";
        u.rate = 1.0;
        u.pitch = 1.0;
        // Voice-Auswahl: erste de-* falls verfügbar
        const voices = synth.getVoices();
        const de = voices.find((v) => /^de(-|_|$)/i.test(v.lang));
        if (de) u.voice = de;
        u.onend = () => {
            utterRef.current = null;
            // Zurück zu listening
            finalAccRef.current = "";
            setLive("");
            setVState("listening");
            try { recogRef.current?.start(); } catch { /* noop */ }
        };
        u.onerror = () => {
            utterRef.current = null;
            setVState("listening");
            try { recogRef.current?.start(); } catch { /* noop */ }
        };
        utterRef.current = u;
        try { synth.speak(u); } catch { /* noop */ }
    }

    async function submit(txt) {
        if (!txt || !apiKey) return;
        if (silenceTRef.current) clearTimeout(silenceTRef.current);
        setVState("thinking");
        try { recogRef.current?.stop(); } catch { /* noop */ }
        finalAccRef.current = "";
        setLive("");
        try {
            await coach.send(txt, apiKey);
            // TTS-Effect triggert sich selbst aufgrund neuer Assistant-Message
        } catch (e) {
            setErrMsg(String(e?.message || e));
            setVState("listening");
            try { recogRef.current?.start(); } catch { /* noop */ }
        }
    }

    function togglePause() {
        if (vState === "listening") {
            setVState("paused");
            try { recogRef.current?.stop(); } catch { /* noop */ }
            if (silenceTRef.current) clearTimeout(silenceTRef.current);
        } else if (vState === "paused") {
            finalAccRef.current = "";
            setLive("");
            setVState("listening");
            try { recogRef.current?.start(); } catch { /* noop */ }
        }
    }

    function close() {
        try { recogRef.current?.stop(); } catch { /* noop */ }
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        if (silenceTRef.current) clearTimeout(silenceTRef.current);
        onClose();
    }

    const orbAnim =
        vState === "listening"
            ? { scale: [1, 1.06, 1], rotate: 0 }
            : vState === "thinking"
            ? { scale: 1, rotate: 360 }
            : vState === "speaking"
            ? { scale: [1, 1.03, 0.98, 1.02, 1] }
            : { scale: 1, rotate: 0 };

    const orbTransition =
        vState === "listening"
            ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
            : vState === "thinking"
            ? { duration: 2.8, repeat: Infinity, ease: "linear" }
            : vState === "speaking"
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1000,
                    background:
                        "radial-gradient(circle at center, rgba(204,120,92,0.08), rgba(250,249,245,0.98))",
                    backdropFilter: "blur(40px)",
                    WebkitBackdropFilter: "blur(40px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                }}
            >
                {/* State Label */}
                <div
                    style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.18em",
                        color: "var(--color-text-secondary)",
                        marginBottom: 32,
                        height: 14,
                    }}
                >
                    {STATE_LABEL[vState]}
                </div>

                {/* Orb */}
                <motion.div
                    animate={orbAnim}
                    transition={orbTransition}
                    style={{
                        width: 240,
                        height: 240,
                        borderRadius: "50%",
                        background:
                            `linear-gradient(135deg, ${tokens.colors.accent.DEFAULT} 0%, ${tokens.colors.accent.secondary} 100%)`,
                        boxShadow:
                            `0 0 60px rgba(204,120,92,0.35), inset 0 0 80px rgba(139,115,85,0.25)`,
                        willChange: "transform",
                    }}
                />

                {/* Live transcript */}
                <div
                    style={{
                        marginTop: 36,
                        minHeight: 60,
                        maxWidth: 560,
                        width: "100%",
                        textAlign: "center",
                        fontSize: 14,
                        color: "var(--color-text-secondary)",
                        opacity: 0.85,
                        lineHeight: 1.55,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {errMsg
                        ? errMsg
                        : vState === "thinking"
                        ? "..."
                        : live || (vState === "listening" ? "Sprich einfach drauflos." : "")}
                </div>

                {/* Bottom row */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 32,
                        left: 0,
                        right: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 32px",
                    }}
                >
                    <button
                        onClick={togglePause}
                        disabled={vState !== "listening" && vState !== "paused"}
                        title={vState === "paused" ? "Mikro an" : "Mikro stumm"}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            cursor:
                                vState === "listening" || vState === "paused"
                                    ? "pointer"
                                    : "not-allowed",
                            border: "0.5px solid var(--color-border-secondary)",
                            background:
                                vState === "paused"
                                    ? "rgba(239,68,68,0.18)"
                                    : "var(--color-background-secondary)",
                            color:
                                vState === "paused" ? "#ef4444" : "var(--color-text-secondary)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {vState === "paused" ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button
                        onClick={close}
                        title="Voice-Modus schließen"
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            cursor: "pointer",
                            border: `0.5px solid ${tokens.colors.accent.border}`,
                            background: tokens.colors.accent.soft,
                            color: tokens.colors.accent.DEFAULT,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
