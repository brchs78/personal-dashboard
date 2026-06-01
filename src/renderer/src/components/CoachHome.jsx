// OLE OS — CoachHome: Claude-Style Startseite
// Empty State: zentriertes Greeting + große Textarea + Quick-Chips.
// Chat State: Messages-Liste oben, sticky Input unten.
// Mic-Button im Input öffnet das VoiceMode-Overlay.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";
import useCoachChat from "../hooks/useCoachChat";
import tokens from "../styles/tokens";
import VoiceMode from "./VoiceMode";

const getKey = () =>
    typeof localStorage !== "undefined"
        ? localStorage.getItem("ole:api-key") || ""
        : "";

function gTxt(a, b) {
    return {
        background: `linear-gradient(135deg,${a},${b})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    };
}

function greeting() {
    const h = new Date().getHours();
    if (h < 11) return "Guten Morgen, Ole";
    if (h < 17) return "Hallo, Ole";
    return "Guten Abend, Ole";
}

function toolPillLabel(ev) {
    const input = ev?.input || {};
    switch (ev?.tool) {
        case "list_todos":          return input.filter ? `list_todos · ${input.filter}` : "list_todos";
        case "add_todo":            return `add_todo${input.title ? `: "${input.title}"` : ""}`;
        case "update_todo":         return "update_todo";
        case "complete_todo":       return "complete_todo";
        case "remove_todo":         return "remove_todo";
        case "get_training_today":  return "training_today";
        case "get_recovery_status": return "recovery";
        default:                    return ev?.tool || "tool";
    }
}

function ToolPill({ ev }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10.5,
                padding: "3px 8px",
                borderRadius: 999,
                background: tokens.colors.accent.secondarySoft,
                border: `0.5px solid ${tokens.colors.accent.border}`,
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
                fontFamily: "var(--font-mono)",
            }}
        >
            ✓ {toolPillLabel(ev)}
        </span>
    );
}

const QUICK_CHIPS = [
    "Guten Morgen, was steht an?",
    "Wie sieht mein heutiges Training aus?",
    "Neues ToDo anlegen",
    "Wie ist mein Recovery?",
];

export default function CoachHome() {
    const coach = useCoachChat();
    const [chatTxt, setChatTxt] = useState("");
    const [voiceOpen, setVoiceOpen] = useState(false);
    const endRef = useRef(null);
    const taRef = useRef(null);

    const hasChat = coach.display.length > 0 || coach.busy;
    const apiKey = getKey();
    const sttAvailable =
        typeof window !== "undefined" &&
        (window.webkitSpeechRecognition || window.SpeechRecognition);

    useLayoutEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [coach.display.length, coach.busy, coach.liveEvents.length]);

    // Auto-grow textarea
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(160, ta.scrollHeight) + "px";
    }, [chatTxt]);

    async function send() {
        const txt = chatTxt.trim();
        if (!txt || coach.busy || !apiKey) return;
        setChatTxt("");
        await coach.send(txt, apiKey);
    }

    function onKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", minHeight: 0 }}>
            {hasChat ? (
                <ChatState
                    coach={coach}
                    endRef={endRef}
                    chatTxt={chatTxt}
                    setChatTxt={setChatTxt}
                    taRef={taRef}
                    onKeyDown={onKeyDown}
                    send={send}
                    apiKey={apiKey}
                    sttAvailable={sttAvailable}
                    onOpenVoice={() => setVoiceOpen(true)}
                />
            ) : (
                <EmptyState
                    chatTxt={chatTxt}
                    setChatTxt={setChatTxt}
                    taRef={taRef}
                    onKeyDown={onKeyDown}
                    send={send}
                    apiKey={apiKey}
                    sttAvailable={sttAvailable}
                    onOpenVoice={() => setVoiceOpen(true)}
                />
            )}

            {voiceOpen && (
                <VoiceMode
                    coach={coach}
                    apiKey={apiKey}
                    onClose={() => setVoiceOpen(false)}
                />
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Empty State — zentriertes Greeting + Textarea + Quick-Chips
// ──────────────────────────────────────────────────────────────────
function EmptyState({ chatTxt, setChatTxt, taRef, onKeyDown, send, apiKey, sttAvailable, onOpenVoice }) {
    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: "12vh",
                paddingLeft: 16,
                paddingRight: 16,
            }}
        >
            <div style={{ width: "100%", maxWidth: 720 }}>
                <h1
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        letterSpacing: "-0.5px",
                        margin: "0 0 6px",
                        textAlign: "center",
                        ...gTxt(tokens.colors.accent.DEFAULT, tokens.colors.accent.secondary),
                    }}
                >
                    {greeting()}
                </h1>
                <p
                    style={{
                        fontSize: 14,
                        color: "var(--color-text-secondary)",
                        textAlign: "center",
                        margin: "0 0 28px",
                    }}
                >
                    Was steht heute an?
                </p>

                <ChatInput
                    chatTxt={chatTxt}
                    setChatTxt={setChatTxt}
                    taRef={taRef}
                    onKeyDown={onKeyDown}
                    send={send}
                    busy={false}
                    apiKey={apiKey}
                    sttAvailable={sttAvailable}
                    onOpenVoice={onOpenVoice}
                />

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 8,
                        marginTop: 18,
                    }}
                >
                    {QUICK_CHIPS.map((q) => (
                        <button
                            key={q}
                            onClick={() => setChatTxt(q)}
                            style={{
                                fontSize: 12,
                                padding: "9px 12px",
                                borderRadius: "var(--border-radius-md)",
                                background: "var(--color-background-secondary)",
                                border: "0.5px solid var(--color-border-tertiary)",
                                cursor: "pointer",
                                color: "var(--color-text-secondary)",
                                textAlign: "left",
                                lineHeight: 1.4,
                                fontFamily: "var(--font-sans)",
                            }}
                        >
                            {q}
                        </button>
                    ))}
                </div>

                {!apiKey && (
                    <p style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>
                        Erst Anthropic API Key in den Settings hinterlegen.
                    </p>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Chat State — Messages-Liste + sticky Input
// ──────────────────────────────────────────────────────────────────
function ChatState({ coach, endRef, chatTxt, setChatTxt, taRef, onKeyDown, send, apiKey, sttAvailable, onOpenVoice }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, maxWidth: 720, width: "100%", margin: "0 auto" }}>
            <div
                style={{
                    padding: "12px 4px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                }}
            >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, ...gTxt(tokens.colors.accent.DEFAULT, tokens.colors.accent.secondary) }}>KI-Coach</p>
                <button
                    onClick={coach.clear}
                    title="Chat zurücksetzen"
                    style={{
                        padding: 6,
                        borderRadius: "var(--border-radius-md)",
                        border: "0.5px solid var(--color-border-tertiary)",
                        background: "transparent",
                        color: "var(--color-text-tertiary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                    }}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    padding: "8px 4px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                {coach.display.map((m) => (
                    <div
                        key={m.id}
                        style={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "86%",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        {m.role === "assistant" && m.toolEvents.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {m.toolEvents.map((ev, idx) => <ToolPill key={idx} ev={ev} />)}
                            </div>
                        )}
                        {m.text && (
                            <div
                                style={{
                                    background: m.role === "user"
                                        ? tokens.colors.accent.soft
                                        : "var(--color-background-secondary)",
                                    color: m.role === "user" ? tokens.colors.accent.DEFAULT : "var(--color-text-primary)",
                                    padding: "9px 13px",
                                    borderRadius: "var(--border-radius-lg)",
                                    fontSize: m.role === "assistant" ? 15 : 13,
                                    fontFamily: m.role === "assistant" ? "var(--font-serif)" : "var(--font-sans)",
                                    lineHeight: m.role === "assistant" ? 1.7 : 1.6,
                                    whiteSpace: "pre-wrap",
                                    border: m.role === "user" ? `0.5px solid ${tokens.colors.accent.border}` : "none",
                                }}
                            >
                                {m.text}
                            </div>
                        )}
                    </div>
                ))}
                {coach.busy && (
                    <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 4 }}>
                        {coach.liveEvents.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {coach.liveEvents.map((ev, idx) => <ToolPill key={idx} ev={ev} />)}
                            </div>
                        )}
                        <div
                            style={{
                                background: "var(--color-background-secondary)",
                                padding: "9px 13px",
                                borderRadius: "var(--border-radius-lg)",
                                fontSize: 13,
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            Coach denkt...
                        </div>
                    </div>
                )}
                {coach.error && (
                    <div
                        style={{
                            alignSelf: "flex-start",
                            background: "rgba(239,68,68,0.08)",
                            border: "0.5px solid rgba(239,68,68,0.25)",
                            color: "#ef4444",
                            padding: "9px 13px",
                            borderRadius: "var(--border-radius-lg)",
                            fontSize: 12,
                        }}
                    >
                        Fehler: {coach.error}
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div style={{ padding: "10px 4px 14px", flexShrink: 0 }}>
                <ChatInput
                    chatTxt={chatTxt}
                    setChatTxt={setChatTxt}
                    taRef={taRef}
                    onKeyDown={onKeyDown}
                    send={send}
                    busy={coach.busy}
                    apiKey={apiKey}
                    sttAvailable={sttAvailable}
                    onOpenVoice={onOpenVoice}
                />
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// ChatInput — geteilt zwischen Empty und Chat State
// ──────────────────────────────────────────────────────────────────
function ChatInput({ chatTxt, setChatTxt, taRef, onKeyDown, send, busy, apiKey, sttAvailable, onOpenVoice }) {
    const canSend = !busy && chatTxt.trim() && apiKey;
    return (
        <div
            style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: "8px 8px 8px 14px",
                borderRadius: "var(--border-radius-lg)",
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
        >
            <textarea
                ref={taRef}
                value={chatTxt}
                onChange={(e) => setChatTxt(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={apiKey ? "Frage deinen Coach..." : "Erst API Key eintragen (Zahnrad)"}
                disabled={busy}
                rows={1}
                style={{
                    flex: 1,
                    resize: "none",
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: "8px 0",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-sans)",
                    outline: "none",
                    maxHeight: 160,
                    overflowY: "auto",
                }}
            />
            <button
                onClick={onOpenVoice}
                disabled={!sttAvailable || busy || !apiKey}
                title={
                    sttAvailable
                        ? apiKey
                            ? "Voice-Modus"
                            : "Erst API Key eintragen"
                        : "Spracheingabe nicht verfügbar"
                }
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    cursor: sttAvailable && !busy && apiKey ? "pointer" : "not-allowed",
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-secondary)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Mic size={15} />
            </button>
            <button
                onClick={send}
                disabled={!canSend}
                style={{
                    width: 36,
                    height: 36,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: "50%",
                    cursor: canSend ? "pointer" : "not-allowed",
                    border: "none",
                    background: canSend
                        ? tokens.colors.accent.gradient
                        : "var(--color-background-secondary)",
                    color: canSend ? "#ffffff" : "var(--color-text-tertiary)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                →
            </button>
        </div>
    );
}
