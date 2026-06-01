// OLE OS — ToDos Renderer-Hook
// Liest aus IPC + abonniert 'todo:updated' für Live-Sync.

import { useCallback, useEffect, useState } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.todo : null;
}

export function useTodos() {
    const [items, setItems] = useState([]);
    const [migrated, setMigrated] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const a = api();
        if (!a) return;
        a.getAll().then((data) => {
            setItems(data?.items || []);
            setMigrated(!!data?.migratedFromLocalStorage);
            setReady(true);
        });
        const unsub = a.onUpdated((data) => {
            setItems(data?.items || []);
            setMigrated(!!data?.migratedFromLocalStorage);
        });
        return () => unsub?.();
    }, []);

    const add = useCallback(async (partial) => {
        const a = api(); if (!a) return;
        return a.add(partial);
    }, []);

    const update = useCallback(async (id, patch) => {
        const a = api(); if (!a) return;
        return a.update(id, patch);
    }, []);

    const remove = useCallback(async (id) => {
        const a = api(); if (!a) return;
        return a.remove(id);
    }, []);

    const toggleDone = useCallback(async (id) => {
        const a = api(); if (!a) return;
        return a.toggleDone(id);
    }, []);

    const reorder = useCallback(async (orderedIds) => {
        const a = api(); if (!a) return;
        return a.reorder(orderedIds);
    }, []);

    const migrate = useCallback(async (legacyItems) => {
        const a = api(); if (!a) return;
        return a.migrate(legacyItems);
    }, []);

    return { items, migrated, ready, add, update, remove, toggleDone, reorder, migrate };
}
