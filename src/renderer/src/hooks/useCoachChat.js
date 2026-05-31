// OLE OS — useCoachChat: Hook für Tool-equipped Coach Chat
// Verbindet sich mit window.oleAPI.coach (Main-Process Tool-Loop).

import { useCallback, useEffect, useState } from "react";

function api() {
    return typeof window !== "undefined" ? window.oleAPI?.coach : null;
}

// Wandelt rohe Anthropic-API-Messages in eine flache Display-Liste:
// { id, role: 'user'|'assistant', text, toolEvents: [{tool, input}] }
function flatten(messages) {
    const out = [];
    let i = 0;
    for (const m of messages || []) {
        if (!m) continue;
        if (m.role === "user") {
            // Pure tool_result-Messages (interner Loop-Schritt) ausblenden
            if (Array.isArray(m.content)) {
                const onlyToolResults = m.content.every(
                    (b) => b && b.type === "tool_result"
                );
                if (onlyToolResults) continue;
                const text = m.content
                    .filter((b) => b.type === "text")
                    .map((b) => b.text)
                    .join("");
                if (text) out.push({ id: i++, role: "user", text, toolEvents: [] });
            } else if (typeof m.content === "string") {
                out.push({ id: i++, role: "user", text: m.content, toolEvents: [] });
            }
        } else if (m.role === "assistant") {
            const blocks = Array.isArray(m.content) ? m.content : [];
            const text = blocks
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join("");
            const toolEvents = blocks
                .filter((b) => b.type === "tool_use")
                .map((b) => ({ tool: b.name, input: b.input }));
            if (text || toolEvents.length) {
                out.push({ id: i++, role: "assistant", text, toolEvents });
            }
        }
    }
    return out;
}

export default function useCoachChat() {
    const [messages, setMessages] = useState([]);    // rohe API-Messages
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [liveEvents, setLiveEvents] = useState([]); // Tool-Events während laufendem Send

    useEffect(() => {
        const a = api();
        if (!a) return;
        a.getHistory().then((msgs) => setMessages(msgs || []));
        a.onHistoryUpdated((msgs) => setMessages(msgs || []));
        a.onToolEvent((ev) => {
            if (ev?.status === "started") {
                setLiveEvents((prev) => [...prev, ev]);
            }
        });
    }, []);

    const send = useCallback(async (userMessage, apiKey) => {
        const txt = String(userMessage || "").trim();
        if (!txt) return;
        const a = api();
        if (!a) {
            setError("coach_api_unavailable");
            return;
        }
        setBusy(true);
        setError(null);
        setLiveEvents([]);
        try {
            const res = await a.send({ apiKey, userMessage: txt });
            if (!res?.ok) setError(res?.error || "unknown_error");
        } catch (e) {
            setError(String(e?.message || e));
        } finally {
            setBusy(false);
            setLiveEvents([]);
        }
    }, []);

    const clear = useCallback(async () => {
        const a = api();
        if (!a) return;
        await a.clear();
    }, []);

    return {
        messages,
        display: flatten(messages),
        busy,
        error,
        liveEvents,
        send,
        clear,
    };
}
