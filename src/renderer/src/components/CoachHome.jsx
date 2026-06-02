// OLE OS — CoachHome: Claude.ai-Style Startseite
// Empty State: zentriertes Serif-Greeting + große ruhige Input-Box + dezente Suggestion-Chips.
// Chat State: Messages-Liste oben, sticky Input unten, Markdown-Rendering, Live-Stream-Bubble.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Mic, Trash2, Sparkles, Activity, CalendarDays, ListTodo } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useCoachChat from "../hooks/useCoachChat";
import { useTheme } from "../hooks/useTheme.jsx";
import VoiceMode from "./VoiceMode";

const getKey = () =>
    typeof localStorage !== "undefined"
        ? localStorage.getItem("ole:api-key") || ""
        : "";

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
        case "get_training_today":    return "training_today";
        case "get_recovery_status":   return "recovery";
        case "get_recent_activities": return input.type ? `strava · ${input.type.toLowerCase()}` : "strava · activities";
        case "get_activity_detail":   return `strava · activity ${input.id ?? ""}`;
        default:                      return ev?.tool || "tool";
    }
}

function ToolPill({ ev }) {
    const { tokens } = useTheme();
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
    { icon: Sparkles,     text: "Guten Morgen, was steht an?" },
    { icon: Activity,     text: "Wie sieht mein heutiges Training aus?" },
    { icon: ListTodo,     text: "Neues ToDo anlegen" },
    { icon: CalendarDays, text: "Wie ist mein Recovery?" },
];

// Markdown-Components für Assistant-Bubbles — alles inline via Tokens.
function buildMdComponents(tokens) {
    return {
        p: ({ node, ...props }) => (
            <p style={{ margin: "0 0 0.6em", lineHeight: 1.7 }} {...props} />
        ),
        ul: ({ node, ...props }) => (
            <ul style={{ margin: "0 0 0.6em", paddingLeft: 20 }} {...props} />
        ),
        ol: ({ node, ...props }) => (
            <ol style={{ margin: "0 0 0.6em", paddingLeft: 20 }} {...props} />
        ),
        li: ({ node, ...props }) => (
            <li style={{ margin: "0.15em 0", lineHeight: 1.6 }} {...props} />
        ),
        strong: ({ node, ...props }) => (
            <strong style={{ fontWeight: 600, color: tokens.colors.text.primary }} {...props} />
        ),
        em: ({ node, ...props }) => (
            <em style={{ fontStyle: "italic" }} {...props} />
        ),
        a: ({ node, ...props }) => (
            <a
                style={{
                    color: tokens.colors.accent.DEFAULT,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                }}
                target="_blank"
                rel="noreferrer"
                {...props}
            />
        ),
        code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
                return (
                    <code
                        style={{
                            fontFamily: tokens.typography.fontFamily.mono,
                            fontSize: "0.88em",
                            padding: "1px 6px",
                            borderRadius: 6,
                            background: tokens.colors.accent.secondarySoft,
                            color: tokens.colors.text.primary,
                        }}
                        {...props}
                    >
                        {children}
                    </code>
                );
            }
            return (
                <code
                    style={{
                        fontFamily: tokens.typography.fontFamily.mono,
                        fontSize: "0.88em",
                        display: "block",
                        whiteSpace: "pre-wrap",
                    }}
                    {...props}
                >
                    {children}
                </code>
            );
        },
        pre: ({ node, ...props }) => (
            <pre
                style={{
                    background: tokens.colors.bg.sunken,
                    border: `0.5px solid ${tokens.colors.border.subtle}`,
                    borderRadius: tokens.radius.md,
                    padding: "10px 12px",
                    margin: "0.4em 0 0.8em",
                    overflowX: "auto",
                    fontSize: 13,
                }}
                {...props}
            />
        ),
        h1: ({ node, ...props }) => (
            <h3 style={{ margin: "0.6em 0 0.3em", fontSize: 18, fontWeight: 600 }} {...props} />
        ),
        h2: ({ node, ...props }) => (
            <h3 style={{ margin: "0.6em 0 0.3em", fontSize: 17, fontWeight: 600 }} {...props} />
        ),
        h3: ({ node, ...props }) => (
            <h4 style={{ margin: "0.5em 0 0.25em", fontSize: 15, fontWeight: 600 }} {...props} />
        ),
        blockquote: ({ node, ...props }) => (
            <blockquote
                style={{
                    margin: "0.4em 0",
                    paddingLeft: 12,
                    borderLeft: `2px solid ${tokens.colors.accent.border}`,
                    color: tokens.colors.text.secondary,
                }}
                {...props}
            />
        ),
    };
}

function AssistantMarkdown({ text }) {
    const { tokens } = useTheme();
    return (
        <div
            style={{
                color: tokens.colors.text.primary,
                fontFamily: tokens.typography.fontFamily.serif,
                fontSize: 16,
                lineHeight: 1.7,
            }}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildMdComponents(tokens)}>
                {text}
            </ReactMarkdown>
        </div>
    );
}

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
    }, [coach.display.length, coach.busy, coach.liveEvents.length, coach.streamingText.length]);

    // Auto-grow textarea
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(180, Math.max(24, ta.scrollHeight)) + "px";
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
// Empty State — Claude.ai-Style: Serif-Greeting + Input + Chips
// ──────────────────────────────────────────────────────────────────
function EmptyState({ chatTxt, setChatTxt, taRef, onKeyDown, send, apiKey, sttAvailable, onOpenVoice }) {
    const { tokens } = useTheme();
    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: "18vh",
                paddingLeft: 16,
                paddingRight: 16,
            }}
        >
            <div style={{ width: "100%", maxWidth: 720 }}>
                <h1
                    style={{
                        fontFamily: tokens.typography.fontFamily.serif,
                        fontSize: 48,
                        fontWeight: 400,
                        letterSpacing: "-0.02em",
                        margin: "0 0 32px",
                        textAlign: "center",
                        color: tokens.colors.accent.DEFAULT,
                        lineHeight: 1.1,
                    }}
                >
                    {greeting()}
                </h1>

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
                        display: "flex",
                        flexDirection: "column",
                        marginTop: 24,
                    }}
                >
                    {QUICK_CHIPS.map(({ icon: Icon, text }) => (
                        <button
                            key={text}
                            onClick={() => setChatTxt(text)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = tokens.colors.bg.sunken;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                fontSize: 14,
                                padding: "12px 14px",
                                borderRadius: tokens.radius.md,
                                background: "transparent",
                                border: "none",
                                borderBottom: `0.5px solid ${tokens.colors.border.subtle}`,
                                cursor: "pointer",
                                color: tokens.colors.text.secondary,
                                textAlign: "left",
                                lineHeight: 1.4,
                                fontFamily: tokens.typography.fontFamily.sans,
                                transition: `background ${tokens.motion.duration.fast}s ease`,
                            }}
                        >
                            <Icon size={15} strokeWidth={1.8} style={{ color: tokens.colors.accent.DEFAULT, flexShrink: 0 }} />
                            <span>{text}</span>
                        </button>
                    ))}
                </div>

                {!apiKey && (
                    <p style={{ marginTop: 18, fontSize: 11, color: tokens.colors.text.tertiary, textAlign: "center" }}>
                        Erst Anthropic API Key in den Settings hinterlegen.
                    </p>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Chat State — Messages-Liste mit Markdown + Live-Stream-Bubble
// ──────────────────────────────────────────────────────────────────
function ChatState({ coach, endRef, chatTxt, setChatTxt, taRef, onKeyDown, send, apiKey, sttAvailable, onOpenVoice }) {
    const { tokens } = useTheme();
    const showStreaming = coach.busy && coach.streamingText;
    const showThinking = coach.busy && !coach.streamingText;
    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, maxWidth: 720, width: "100%", margin: "0 auto" }}>
            <div
                style={{
                    padding: "12px 4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={coach.clear}
                    title="Chat zurücksetzen"
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.5; }}
                    style={{
                        padding: 6,
                        borderRadius: tokens.radius.md,
                        border: "none",
                        background: "transparent",
                        color: tokens.colors.text.tertiary,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        opacity: 0.5,
                        transition: "opacity 0.15s ease",
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
                    gap: 14,
                }}
            >
                {coach.display.map((m) => (
                    <MessageRow key={m.id} m={m} />
                ))}

                {showStreaming && (
                    <div style={{ alignSelf: "flex-start", maxWidth: "92%", display: "flex", flexDirection: "column", gap: 6 }}>
                        {coach.liveEvents.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {coach.liveEvents.map((ev, idx) => <ToolPill key={idx} ev={ev} />)}
                            </div>
                        )}
                        <div style={{ padding: "4px 0" }}>
                            <AssistantMarkdown text={coach.streamingText} />
                            <BlinkingCaret tokens={tokens} />
                        </div>
                    </div>
                )}

                {showThinking && (
                    <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 6 }}>
                        {coach.liveEvents.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {coach.liveEvents.map((ev, idx) => <ToolPill key={idx} ev={ev} />)}
                            </div>
                        )}
                        <div
                            style={{
                                fontSize: 14,
                                fontFamily: tokens.typography.fontFamily.serif,
                                color: tokens.colors.text.secondary,
                                fontStyle: "italic",
                                padding: "4px 0",
                            }}
                        >
                            Coach denkt
                            <ThinkingDots />
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
                            borderRadius: tokens.radius.lg,
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

function MessageRow({ m }) {
    const { tokens } = useTheme();
    if (m.role === "user") {
        return (
            <div
                style={{
                    alignSelf: "flex-end",
                    maxWidth: "86%",
                    background: tokens.colors.accent.soft,
                    color: tokens.colors.accent.DEFAULT,
                    padding: "10px 14px",
                    borderRadius: tokens.radius.lg,
                    fontSize: 14,
                    fontFamily: tokens.typography.fontFamily.sans,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    border: `0.5px solid ${tokens.colors.accent.border}`,
                }}
            >
                {m.text}
            </div>
        );
    }
    return (
        <div style={{ alignSelf: "flex-start", maxWidth: "92%", display: "flex", flexDirection: "column", gap: 6 }}>
            {m.toolEvents.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {m.toolEvents.map((ev, idx) => <ToolPill key={idx} ev={ev} />)}
                </div>
            )}
            {m.text && (
                <div style={{ padding: "4px 0" }}>
                    <AssistantMarkdown text={m.text} />
                </div>
            )}
        </div>
    );
}

function BlinkingCaret({ tokens }) {
    return (
        <span
            style={{
                display: "inline-block",
                width: 8,
                height: 16,
                marginLeft: 2,
                verticalAlign: "text-bottom",
                background: tokens.colors.accent.DEFAULT,
                borderRadius: 1,
                animation: "olecaret 1s steps(2) infinite",
            }}
        >
            <style>{`@keyframes olecaret { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
        </span>
    );
}

function ThinkingDots() {
    return (
        <span style={{ display: "inline-block", marginLeft: 2 }}>
            <span style={{ animation: "oledot 1.4s infinite", display: "inline-block" }}>.</span>
            <span style={{ animation: "oledot 1.4s infinite 0.2s", display: "inline-block" }}>.</span>
            <span style={{ animation: "oledot 1.4s infinite 0.4s", display: "inline-block" }}>.</span>
            <style>{`@keyframes oledot { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }`}</style>
        </span>
    );
}

// ──────────────────────────────────────────────────────────────────
// ChatInput — geteilt zwischen Empty und Chat State (Claude-Style: rund, ruhig)
// ──────────────────────────────────────────────────────────────────
function ChatInput({ chatTxt, setChatTxt, taRef, onKeyDown, send, busy, apiKey, sttAvailable, onOpenVoice }) {
    const { tokens } = useTheme();
    const canSend = !busy && chatTxt.trim() && apiKey;
    return (
        <div
            style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: "12px 14px",
                borderRadius: tokens.radius.xl,
                background: tokens.colors.bg.elevated,
                border: `0.5px solid ${tokens.colors.border.glass}`,
                boxShadow: tokens.shadow.card,
            }}
        >
            <textarea
                ref={taRef}
                value={chatTxt}
                onChange={(e) => setChatTxt(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={apiKey ? "Wie kann ich dir helfen?" : "Erst API Key eintragen (Zahnrad)"}
                disabled={busy}
                rows={1}
                style={{
                    flex: 1,
                    resize: "none",
                    fontSize: 15,
                    lineHeight: 1.5,
                    padding: "6px 4px",
                    border: "none",
                    background: "transparent",
                    color: tokens.colors.text.primary,
                    fontFamily: tokens.typography.fontFamily.sans,
                    outline: "none",
                    minHeight: 24,
                    maxHeight: 180,
                    overflowY: "auto",
                }}
            />
            <button
                onClick={onOpenVoice}
                disabled={!sttAvailable || busy || !apiKey}
                title={
                    sttAvailable
                        ? apiKey ? "Voice-Modus" : "Erst API Key eintragen"
                        : "Spracheingabe nicht verfügbar"
                }
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    cursor: sttAvailable && !busy && apiKey ? "pointer" : "not-allowed",
                    border: `0.5px solid ${tokens.colors.border.glass}`,
                    background: "transparent",
                    color: tokens.colors.text.secondary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Mic size={14} />
            </button>
            <button
                onClick={send}
                disabled={!canSend}
                style={{
                    width: 32,
                    height: 32,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: "50%",
                    cursor: canSend ? "pointer" : "not-allowed",
                    border: "none",
                    background: canSend
                        ? tokens.colors.accent.DEFAULT
                        : tokens.colors.bg.sunken,
                    color: canSend ? "#ffffff" : tokens.colors.text.tertiary,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                ↑
            </button>
        </div>
    );
}
