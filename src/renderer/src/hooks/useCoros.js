// OLE OS — Renderer-Hooks für COROS-Health-Daten
// Spricht IPC über window.oleAPI.coros an und cached in React-State.

import { useEffect, useState, useCallback } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.coros : null;
}

export function useCorosSummary() {
    const [summary, setSummary] = useState(null);    // snapshot.latest
    const [status, setStatus] = useState('loading'); // loading | ready | disconnected | syncing | error
    const [syncedAt, setSyncedAt] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        const a = api();
        if (!a) return;
        try {
            const st = await a.status();
            if (!st?.connected) {
                setSummary(null);
                setSyncedAt(null);
                setStatus('disconnected');
                return;
            }
            const cache = await a.getSummary();
            setSummary(cache?.latest || null);
            setSyncedAt(cache?.meta?.syncedAt || st.syncedAt || null);
            setStatus('ready');
        } catch (e) {
            setStatus('error');
            setError(String(e));
        }
    }, []);

    useEffect(() => {
        const a = api();
        if (!a) return;

        load();

        const unsubStatus = a.onStatus(() => load());
        const unsubReady = a.onReady(() => load());

        return () => { unsubStatus?.(); unsubReady?.(); };
    }, [load]);

    const connect = useCallback(async () => {
        const a = api();
        if (!a) return;
        setStatus('syncing');
        try {
            await a.connect();
        } catch (e) {
            setStatus('error');
            setError(String(e));
        }
        load();
    }, [load]);

    const disconnect = useCallback(async () => {
        const a = api();
        if (!a) return;
        await a.disconnect();
        load();
    }, [load]);

    const refresh = useCallback(async () => {
        const a = api();
        if (!a) return;
        setStatus('syncing');
        try {
            await a.refresh();
        } catch (e) {
            setStatus('error');
            setError(String(e));
        }
        load();
    }, [load]);

    return { summary, status, syncedAt, error, connect, disconnect, refresh };
}

export function useCorosTrend(metric, days = 30) {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const a = api();
        if (!a) return;
        let cancelled = false;
        setLoading(true);
        a.getTrends(metric, days)
            .then((res) => {
                if (!cancelled) {
                    setPoints(Array.isArray(res) ? res : []);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });

        const refetch = () => {
            a.getTrends(metric, days).then((res) => {
                if (!cancelled) setPoints(Array.isArray(res) ? res : []);
            });
        };
        const unsubReady = a.onReady(refetch);

        return () => { cancelled = true; unsubReady?.(); };
    }, [metric, days]);

    return { points, loading };
}
