// OLE OS — Calendar Renderer-Hook
// Liest aus IPC + abonniert 'calendar:updated' für Live-Sync.

import { useCallback, useEffect, useState } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.calendar : null;
}

export function useCalendar() {
    const [events, setEvents] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const a = api();
        if (!a) return;
        a.list().then((data) => {
            setEvents(data?.events || []);
            setSubscriptions(data?.subscriptions || []);
            setReady(true);
        });
        a.onUpdated((data) => {
            setEvents(data?.events || []);
            setSubscriptions(data?.subscriptions || []);
        });
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

    const updateEvent = useCallback(async (id, patch) => {
        const a = api();
        if (!a) return;
        return a.updateInternal(id, patch);
    }, []);

    const deleteEvent = useCallback(async (id) => {
        const a = api();
        if (!a) return;
        return a.deleteInternal(id);
    }, []);

    return {
        events,
        subscriptions,
        ready,
        busy,
        error,
        refresh,
        addSub,
        removeSub,
        addEvent,
        updateEvent,
        deleteEvent,
    };
}
