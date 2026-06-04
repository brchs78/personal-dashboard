// OLE OS — useRoutine Hook
// Lädt Routinen, lauscht auf Updates, berechnet Startzeiten clientseitig.
import { useCallback, useEffect, useMemo, useState } from "react";

// Spezialregeln spiegeln routine-store.js (Offset-Minuten ab Routine-Startzeit).
const SPECIAL_RULES = {
    morning: [
        { id: "no-phone", emoji: "📵", label: "Kein Handy", mode: "until", offset: 30 },
        { id: "coffee", emoji: "☕", label: "Kaffee", mode: "from", offset: 90 },
        { id: "monday-review", emoji: "📅", label: "Wochenvorschau", mode: "mondayUntil", offset: 100 },
    ],
    evening: [
        { id: "screens-off", emoji: "📵", label: "Bildschirme aus", mode: "fromStart", offset: 0 },
        { id: "white-noise", emoji: "🔇", label: "White Noise", mode: "fromStart", offset: 45 },
        { id: "bedroom-temp", emoji: "❄️", label: "Schlafzimmer 18–20°C", mode: "static" },
        { id: "no-caffeine", emoji: "☕", label: "Kein Koffein", mode: "fixed", fixedTime: "14:00" },
    ],
};

// Negative-safe: "22:20" + (-80) → "21:00"
function addMinutes(time, minutes) {
    const [h, m] = String(time).split(":").map((n) => parseInt(n, 10));
    const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Berechnet Startzeiten + Gesamtdauer/Endzeit + Spezialregel-Zeiten.
// forward: wakeTime = Startanker; backward: wakeTime = Endanker (Schlafenszeit)
export function computeSchedule(routine, routineId) {
    if (!routine || !Array.isArray(routine.steps)) return null;
    const direction = routine.direction || (routineId === "evening" ? "backward" : "forward");
    const totalDuration = routine.steps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const startAnchor = direction === "backward"
        ? addMinutes(routine.wakeTime, -totalDuration)
        : routine.wakeTime;
    let cursor = 0;
    const steps = routine.steps.map((s) => {
        const startTime = addMinutes(startAnchor, cursor);
        cursor += s.duration;
        return { ...s, startTime };
    });
    const endTime = direction === "backward" ? routine.wakeTime : addMinutes(startAnchor, totalDuration);
    const rules = (SPECIAL_RULES[routineId] || []).map((r) => ({
        ...r,
        time: r.mode === "static" ? null
            : r.mode === "fixed" ? r.fixedTime
            : addMinutes(startAnchor, r.offset),
    }));
    return { direction, wakeTime: routine.wakeTime, startTime: startAnchor, steps, totalDuration, endTime, rules };
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

    const updateSteps = useCallback(async (steps) => {
        // Optimistisch lokal setzen, IPC bestätigt via onUpdated
        setRoutines((prev) =>
            prev[routineId] ? { ...prev, [routineId]: { ...prev[routineId], steps } } : prev
        );
        await window.oleAPI?.routine?.updateSteps(routineId, steps);
    }, [routineId]);

    const schedule = useMemo(
        () => computeSchedule(routines[routineId], routineId),
        [routines, routineId]
    );

    return { routine: routines[routineId], schedule, setWakeTime, updateSteps, refresh };
}
