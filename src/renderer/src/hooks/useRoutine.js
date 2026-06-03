// OLE OS — useRoutine Hook
// Lädt Routinen, lauscht auf Updates, berechnet Startzeiten clientseitig.
import { useCallback, useEffect, useMemo, useState } from "react";

// Spezialregeln spiegeln routine-store.js (Offset-Minuten ab wakeTime).
const SPECIAL_RULES = {
    morning: [
        { id: "no-phone", emoji: "📵", label: "Kein Handy", mode: "until", offset: 30 },
        { id: "coffee", emoji: "☕", label: "Kaffee", mode: "from", offset: 90 },
        { id: "monday-review", emoji: "📅", label: "Wochenvorschau", mode: "mondayUntil", offset: 100 },
    ],
};

// "06:30" + 90 → "08:00"
function addMinutes(time, minutes) {
    const [h, m] = String(time).split(":").map((n) => parseInt(n, 10));
    const total = (h * 60 + m + minutes) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Berechnet Startzeiten + Gesamtdauer/Endzeit + Spezialregel-Zeiten.
export function computeSchedule(routine, routineId) {
    if (!routine || !Array.isArray(routine.steps)) return null;
    let cursor = 0;
    const steps = routine.steps.map((s) => {
        const startTime = addMinutes(routine.wakeTime, cursor);
        cursor += s.duration;
        return { ...s, startTime };
    });
    const totalDuration = cursor;
    const endTime = addMinutes(routine.wakeTime, totalDuration);
    const rules = (SPECIAL_RULES[routineId] || []).map((r) => ({
        ...r,
        time: addMinutes(routine.wakeTime, r.offset),
    }));
    return { wakeTime: routine.wakeTime, steps, totalDuration, endTime, rules };
}

export function useRoutine(routineId = "morning") {
    const [routines, setRoutines] = useState({});

    const refresh = useCallback(async () => {
        const data = await window.oleAPI?.routine?.getAll();
        if (data?.routines) setRoutines(data.routines);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const unsub = window.oleAPI?.routine?.onUpdated?.((data) => {
            if (data?.routines) setRoutines(data.routines);
        });
        return () => { if (typeof unsub === "function") unsub(); };
    }, []);

    const setWakeTime = useCallback(async (time) => {
        // Optimistisch lokal setzen, IPC bestätigt via onUpdated
        setRoutines((prev) =>
            prev[routineId] ? { ...prev, [routineId]: { ...prev[routineId], wakeTime: time } } : prev
        );
        await window.oleAPI?.routine?.setWakeTime(routineId, time);
    }, [routineId]);

    const schedule = useMemo(
        () => computeSchedule(routines[routineId], routineId),
        [routines, routineId]
    );

    return { routine: routines[routineId], schedule, setWakeTime, refresh };
}
