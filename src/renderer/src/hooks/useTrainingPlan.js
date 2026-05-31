// OLE OS — Trainingsplan Renderer-Hook

import { useEffect, useState, useCallback } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.plan : null;
}

function getKey() {
    try { return localStorage.getItem('ole:api-key') || ''; } catch { return ''; }
}

export function useTrainingPlan() {
    const [plan, setPlan] = useState(null);
    const [done, setDone] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        const a = api(); if (!a) return;
        try {
            const { current, done } = await a.getCurrent();
            setPlan(current);
            setDone(done || {});
        } catch (e) { setError(String(e)); }
    }, []);

    useEffect(() => {
        const a = api(); if (!a) return;
        refresh();
        a.onUpdated(({ plan }) => setPlan(plan));
        a.onDoneUpdated((map) => setDone(map || {}));
    }, [refresh]);

    const generate = useCallback(async (weekStart) => {
        const a = api(); if (!a) return;
        const apiKey = getKey();
        if (!apiKey) { setError('Kein API-Key in Settings hinterlegt'); return; }
        setBusy(true); setError(null);
        try {
            const next = await a.generate({ apiKey, weekStart });
            setPlan(next);
        } catch (e) {
            setError(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    }, []);

    const toggleDone = useCallback(async (date) => {
        const a = api(); if (!a) return;
        const next = !done[date];
        const map = await a.markDone(date, next);
        setDone(map || {});
    }, [done]);

    const clear = useCallback(async () => {
        const a = api(); if (!a) return;
        await a.clear();
        setPlan(null);
    }, []);

    return { plan, done, busy, error, generate, toggleDone, clear, refresh };
}
