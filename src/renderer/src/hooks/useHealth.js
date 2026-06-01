// OLE OS — Renderer-Hooks für Apple-Health-Daten
// Spricht IPC über window.oleAPI.health an und cached in React-State.

import { useEffect, useState, useCallback } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.health : null;
}

export function useHealthSummary() {
    const [summary, setSummary] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | ready | parsing | error | no-source
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    const fetchSummary = useCallback(async () => {
        const a = api();
        if (!a) return;
        try {
            const res = await a.getSummary();
            if (res?.summary) {
                setSummary(res.summary);
                setStatus(res.status || 'ready');
            } else {
                setStatus(res?.status || 'loading');
            }
        } catch (e) {
            setStatus('error');
            setError(String(e));
        }
    }, []);

    useEffect(() => {
        const a = api();
        if (!a) return;

        fetchSummary();

        const unsubReady = a.onReady((payload) => {
            if (payload?.status === 'error') {
                setStatus('error');
                setError(payload.error || 'parse error');
                return;
            }
            if (payload?.status === 'no-source') {
                setStatus('no-source');
                return;
            }
            fetchSummary();
        });

        const unsubProgress = a.onProgress((payload) => {
            setStatus('parsing');
            setProgress(payload?.percent ?? 0);
        });

        return () => { unsubReady?.(); unsubProgress?.(); };
    }, [fetchSummary]);

    const refresh = useCallback(async () => {
        const a = api();
        if (!a) return;
        setStatus('parsing');
        setProgress(0);
        await a.refresh();
        fetchSummary();
    }, [fetchSummary]);

    return { summary, status, progress, error, refresh };
}

export function useHealthTrend(metric, days = 30) {
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
