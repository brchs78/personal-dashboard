// OLE OS — Theme Context + Hook
// Provides tokens object that updates when theme mode changes.
// Persists preference in localStorage('ole:theme').

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildTokens } from "../styles/tokens";

const ThemeContext = createContext(null);

function getInitialMode() {
    try {
        const stored = localStorage.getItem("ole:theme");
        if (stored === "dark" || stored === "light") return stored;
    } catch {}
    return "light";
}

export function ThemeProvider({ children }) {
    const [mode, setMode] = useState(getInitialMode);
    const tokens = useMemo(() => buildTokens(mode), [mode]);

    const toggle = useCallback(() => {
        setMode((m) => {
            const next = m === "dark" ? "light" : "dark";
            try { localStorage.setItem("ole:theme", next); } catch {}
            return next;
        });
    }, []);

    // Sync CSS custom properties + body background when mode changes
    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        const c = tokens.colors;

        root.style.colorScheme = mode;
        body.style.background = c.bg.base;
        body.style.color = c.text.primary;

        root.style.setProperty("--color-background-primary", c.bg.base);
        root.style.setProperty("--color-background-secondary", c.bg.sunken);
        root.style.setProperty("--color-text-primary", c.text.primary);
        root.style.setProperty("--color-text-secondary", c.text.secondary);
        root.style.setProperty("--color-text-tertiary", c.text.tertiary);
        root.style.setProperty("--color-border-primary", c.accent.border);
        root.style.setProperty("--color-border-secondary", c.border.glass);
        root.style.setProperty("--color-border-tertiary", c.border.subtle);
        root.style.setProperty("--border-radius-md", tokens.radius.md);
        root.style.setProperty("--border-radius-lg", tokens.radius.lg);

        // Scrollbar thumb
        const style = document.getElementById("ole-theme-style") || document.createElement("style");
        style.id = "ole-theme-style";
        style.textContent = `::-webkit-scrollbar-thumb { background: ${c.border.glass}; border-radius: 4px; }`;
        if (!style.parentNode) document.head.appendChild(style);
    }, [mode, tokens]);

    const value = useMemo(() => ({ tokens, mode, toggle }), [tokens, mode, toggle]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        // Fallback for code that runs outside ThemeProvider (shouldn't happen)
        return { tokens: buildTokens("light"), mode: "light", toggle: () => {} };
    }
    return ctx;
}
