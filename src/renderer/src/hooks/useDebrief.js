// OLE OS — useDebrief Hook
// Lädt/persistiert den Abend-Debrief (Reflexion + Top-3 für morgen) pro Datum.
// Loop: Abends erfassen → morgens im Briefing wieder anzeigen.
import { useCallback, useEffect, useState } from "react";
import { todayISO } from "../lib/date.js";

const EMPTY = { wentWell: "", wentBad: "", tomorrowPriorities: ["", "", ""] };

export function useDebrief(date) {
    const iso = date || todayISO();
    const [entry, setEntry] = useState({ date: iso, ...EMPTY });

    const refresh = useCallback(async () => {
        const data = await window.oleAPI?.debrief?.get(iso);
        if (data) setEntry(data);
    }, [iso]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        const unsub = window.oleAPI?.debrief?.onUpdated?.(() => refresh());
        return () => { if (typeof unsub === "function") unsub(); };
    }, [refresh]);

    const save = useCallback(async (patch) => {
        // Optimistisch lokal, IPC bestätigt via onUpdated
        setEntry((prev) => ({ ...prev, ...patch }));
        await window.oleAPI?.debrief?.set(iso, patch);
    }, [iso]);

    return { entry, save, refresh };
}
