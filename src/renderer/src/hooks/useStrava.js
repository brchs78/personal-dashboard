// OLE OS — Strava Renderer-Hooks

import { useEffect, useState, useCallback } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.strava : null;
}

export function useStrava() {
    const [status, setStatus] = useState({ connected: false });
    const [activities, setActivities] = useState([]);
    const [lastSync, setLastSync] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const refreshStatus = useCallback(async () => {
        const a = api(); if (!a) return;
        try { setStatus(await a.status()); } catch (e) { setError(String(e)); }
    }, []);

    const loadCached = useCallback(async () => {
        const a = api(); if (!a) return;
        try {
            const res = await a.listActivities({ limit: 20 });
            setActivities(res.activities || []);
            setLastSync(res.lastSync);
        } catch (e) { /* still ok */ }
    }, []);

    useEffect(() => {
        const a = api(); if (!a) return;
        refreshStatus();
        loadCached();
        a.onStatus((s) => setStatus(s));
        a.onActivities(({ lastSync }) => {
            setLastSync(lastSync);
            loadCached();
        });
    }, [refreshStatus, loadCached]);

    const connect = useCallback(async () => {
        const a = api(); if (!a) return;
        setBusy(true); setError(null);
        try { await a.connect(); }
        catch (e) { setError(String(e)); }
        finally { setBusy(false); }
    }, []);

    const disconnect = useCallback(async () => {
        const a = api(); if (!a) return;
        setBusy(true);
        try { await a.disconnect(); setActivities([]); setLastSync(null); }
        finally { setBusy(false); }
    }, []);

    const sync = useCallback(async () => {
        const a = api(); if (!a) return;
        setBusy(true); setError(null);
        try { await a.sync({ perPage: 30 }); }
        catch (e) { setError(String(e)); }
        finally { setBusy(false); }
    }, []);

    return { status, activities, lastSync, busy, error, connect, disconnect, sync };
}
