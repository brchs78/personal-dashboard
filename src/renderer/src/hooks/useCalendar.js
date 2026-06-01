// OLE OS — Calendar Renderer-Hook
// Liest aus IPC + abonniert 'calendar:updated' für Live-Sync.

import { useCallback, useEffect, useState } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.calendar : null;
}

export function useCalendar() {
    const [events, setEvents] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [caldav, setCaldav] = useState({ connected: false });
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const a = api();
        if (!a) return;
        a.list().then((data) => {
            setEvents(data?.events || []);
            setSubscriptions(data?.subscriptions || []);
            setCaldav(data?.caldav || { connected: false });
            setReady(true);
        });
        const unsub = a.onUpdated((data) => {
            setEvents(data?.events || []);
            setSubscriptions(data?.subscriptions || []);
            if (data?.caldav) setCaldav(data.caldav);
        });
        return () => unsub?.();
    }, []);

    const refresh = useCallback(async () => {
        const a = api();
        if (!a) return;
        setBusy(true);
        setError(null);
        try {
            await a.refreshNow();
        } catch (e) {
            setError(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    }, []);

    const addSub = useCallback(async ({ label, url }) => {
        const a = api();
        if (!a) return;
        setBusy(true);
        setError(null);
        try {
            return await a.addSub({ label, url });
        } catch (e) {
            setError(String(e?.message || e));
            throw e;
        } finally {
            setBusy(false);
        }
    }, []);

    const removeSub = useCallback(async (id) => {
        const a = api();
        if (!a) return;
        return a.removeSub(id);
    }, []);

    const addEvent = useCallback(async (partial) => {
        const a = api();
        if (!a) return;
        return a.addInternal(partial);
    }, []);

    // event optional: für CalDAV-Events das vollständige Objekt mitgeben (url+etag).
    const updateEvent = useCallback(async (id, patch, event) => {
        const a = api();
        if (!a) return;
        return a.updateInternal(id, patch, event);
    }, []);

    // CalDAV-Events: ganzes Objekt übergeben; internal: ID-String.
    const deleteEvent = useCallback(async (idOrEvent) => {
        const a = api();
        if (!a) return;
        return a.deleteInternal(idOrEvent);
    }, []);

    // ── CalDAV (iCloud) ────────────────────────────────────────────
    const caldavConnect = useCallback(async ({ appleId, password }) => {
        const a = api();
        if (!a?.caldav) return;
        setBusy(true);
        setError(null);
        try {
            const status = await a.caldav.connect({ appleId, password });
            setCaldav(status);
            return status;
        } catch (e) {
            setError(String(e?.message || e));
            throw e;
        } finally {
            setBusy(false);
        }
    }, []);

    const caldavDisconnect = useCallback(async () => {
        const a = api();
        if (!a?.caldav) return;
        await a.caldav.disconnect();
        setCaldav({ connected: false });
    }, []);

    const caldavSetVisible = useCallback(async (urls) => {
        const a = api();
        if (!a?.caldav) return;
        const status = await a.caldav.setVisible(urls);
        setCaldav(status);
        return status;
    }, []);

    const caldavSetTarget = useCallback(async (url) => {
        const a = api();
        if (!a?.caldav) return;
        const status = await a.caldav.setTarget(url);
        setCaldav(status);
        return status;
    }, []);

    return {
        events,
        subscriptions,
        caldav,
        ready,
        busy,
        error,
        refresh,
        addSub,
        removeSub,
        addEvent,
        updateEvent,
        deleteEvent,
        caldavConnect,
        caldavDisconnect,
        caldavSetVisible,
        caldavSetTarget,
    };
}
