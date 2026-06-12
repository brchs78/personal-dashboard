// OLE OS — useTrainingLog Hook
// Subjektives Tages-Feedback (RPE, Beine, Niggles) + offene Niggles der letzten Tage.
import { useCallback, useEffect, useState } from "react";
import { todayISO } from "../lib/date.js";

const EMPTY = { rpe: null, legs: null, niggles: [], note: "" };

export function useTrainingLog(date) {
    const iso = date || todayISO();
    const [entry, setEntry] = useState({ date: iso, ...EMPTY });

    const refresh = useCallback(async () => {
        const data = await window.oleAPI?.trainingLog?.get(iso);
        if (data) setEntry(data);
    }, [iso]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        const unsub = window.oleAPI?.trainingLog?.onUpdated?.(() => refresh());
        return () => { if (typeof unsub === "function") unsub(); };
    }, [refresh]);

    const save = useCallback(async (patch) => {
        setEntry((prev) => ({ ...prev, ...patch }));
        await window.oleAPI?.trainingLog?.set(iso, patch);
    }, [iso]);

    return { entry, save, refresh };
}

export function useRecentNiggles(days = 14) {
    const [niggles, setNiggles] = useState([]);

    const refresh = useCallback(async () => {
        const data = await window.oleAPI?.trainingLog?.recentNiggles(days);
        if (Array.isArray(data)) setNiggles(data);
    }, [days]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        const unsub = window.oleAPI?.trainingLog?.onUpdated?.(() => refresh());
        return () => { if (typeof unsub === "function") unsub(); };
    }, [refresh]);

    return { niggles, refresh };
}
