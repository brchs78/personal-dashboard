// OLE OS — useHabits Hook
import { useCallback, useEffect, useState } from "react";

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

export function useHabits() {
    const [habits, setHabits] = useState([]);
    const [checkins, setCheckins] = useState({});
    const [streaks, setStreaks] = useState({});

    const refresh = useCallback(async () => {
        const data = await window.oleAPI?.habit?.getAll();
        if (!data) return;
        setHabits((data.habits || []).filter((h) => !h.archived));
        setCheckins(data.checkins || {});
    }, []);

    useEffect(() => {
        refresh();
        // Compute streaks client-side from checkins (mirrors server logic)
    }, [refresh]);

    // Re-compute streaks whenever checkins change
    useEffect(() => {
        const active = habits;
        const result = {};
        for (const habit of active) {
            let streak = 0;
            const today = new Date();
            const todayStr = todayISO();
            const checkedToday =
                Array.isArray(checkins[todayStr]) && checkins[todayStr].includes(habit.id);
            let cursor = new Date(today);
            if (!checkedToday) cursor.setDate(cursor.getDate() - 1);
            for (let i = 0; i < 365; i++) {
                const dateStr = cursor.toISOString().slice(0, 10);
                const done =
                    Array.isArray(checkins[dateStr]) && checkins[dateStr].includes(habit.id);
                if (!done) break;
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            }
            if (checkedToday && streak === 0) streak = 1;
            else if (checkedToday) streak++;
            result[habit.id] = streak;
        }
        setStreaks(result);
    }, [habits, checkins]);

    // Listen for IPC broadcasts
    useEffect(() => {
        const unsub = window.oleAPI?.habit?.onUpdated?.((data) => {
            if (!data) return;
            setHabits((data.habits || []).filter((h) => !h.archived));
            setCheckins(data.checkins || {});
        });
        return () => { if (typeof unsub === "function") unsub(); };
    }, []);

    const addHabit = useCallback(async (partial) => {
        await window.oleAPI?.habit?.add(partial);
    }, []);

    const removeHabit = useCallback(async (id) => {
        await window.oleAPI?.habit?.remove({ id });
    }, []);

    const toggleCheckin = useCallback(async (habitId, date) => {
        const d = date || todayISO();
        const currentlyDone =
            Array.isArray(checkins[d]) && checkins[d].includes(habitId);
        await window.oleAPI?.habit?.checkin({ id: habitId, date: d, done: !currentlyDone });
    }, [checkins]);

    const todayScore = useCallback(() => {
        const today = todayISO();
        const done = (checkins[today] || []).filter((id) =>
            habits.some((h) => h.id === id)
        ).length;
        return { done, total: habits.length };
    }, [habits, checkins]);

    const isCheckedIn = useCallback((habitId, date) => {
        const d = date || todayISO();
        return Array.isArray(checkins[d]) && checkins[d].includes(habitId);
    }, [checkins]);

    return { habits, checkins, streaks, addHabit, removeHabit, toggleCheckin, todayScore, isCheckedIn, refresh };
}
