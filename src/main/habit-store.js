// OLE OS — Habit Store (Atomic Habits)
// Persistiert habits + checkins in userData/habits.json.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function habitsPath() {
    return path.join(app.getPath('userData'), 'habits.json');
}

function emptyState() {
    return { habits: [], checkins: {} };
}

function loadRaw() {
    try {
        const p = habitsPath();
        if (!fs.existsSync(p)) return emptyState();
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
            habits: Array.isArray(data.habits) ? data.habits : [],
            checkins: (data.checkins && typeof data.checkins === 'object') ? data.checkins : {},
        };
    } catch (e) {
        console.warn('[habit-store] load failed, resetting:', e?.message);
        return emptyState();
    }
}

function saveRaw(data) {
    fs.writeFileSync(habitsPath(), JSON.stringify(data, null, 2));
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

// Returns { habits, checkins }
function getAll() {
    return loadRaw();
}

function addHabit(partial = {}) {
    const data = loadRaw();
    const habit = {
        id: crypto.randomUUID(),
        name: String(partial.name || '').trim() || 'Neue Gewohnheit',
        emoji: String(partial.emoji || '✅').trim(),
        identity: String(partial.identity || '').trim(),
        twoMinuteVersion: String(partial.twoMinuteVersion || '').trim(),
        category: ['mindset', 'health', 'productivity', 'fitness'].includes(partial.category)
            ? partial.category
            : 'mindset',
        createdAt: new Date().toISOString(),
        archived: false,
    };
    data.habits.push(habit);
    saveRaw(data);
    return data;
}

// Partial-Update für bestehende Habits (Name, Emoji, Identity, 2-min, Category)
function updateHabit(id, patch = {}) {
    const data = loadRaw();
    const idx = data.habits.findIndex((h) => h.id === id);
    if (idx < 0) return data;
    const current = data.habits[idx];
    const next = { ...current };
    if (typeof patch.name === 'string') next.name = patch.name.trim() || current.name;
    if (typeof patch.emoji === 'string') next.emoji = patch.emoji.trim() || current.emoji;
    if (typeof patch.identity === 'string') next.identity = patch.identity.trim();
    if (typeof patch.twoMinuteVersion === 'string') next.twoMinuteVersion = patch.twoMinuteVersion.trim();
    if (['mindset', 'health', 'productivity', 'fitness'].includes(patch.category)) {
        next.category = patch.category;
    }
    data.habits[idx] = next;
    saveRaw(data);
    return data;
}

// Soft-delete: archived:true preserves streak history
function removeHabit(id) {
    const data = loadRaw();
    const idx = data.habits.findIndex((h) => h.id === id);
    if (idx >= 0) data.habits[idx] = { ...data.habits[idx], archived: true };
    saveRaw(data);
    return data;
}

// Toggle checkin for a habit on a date
function checkin(id, date, done) {
    const d = date || todayISO();
    const data = loadRaw();
    if (!Array.isArray(data.checkins[d])) data.checkins[d] = [];
    if (done) {
        if (!data.checkins[d].includes(id)) data.checkins[d].push(id);
    } else {
        data.checkins[d] = data.checkins[d].filter((x) => x !== id);
        if (data.checkins[d].length === 0) delete data.checkins[d];
    }
    saveRaw(data);
    return data;
}

// Returns { habitId: currentStreak } for all active habits
function getStreaks() {
    const data = loadRaw();
    const activeHabits = data.habits.filter((h) => !h.archived);
    const result = {};

    for (const habit of activeHabits) {
        let streak = 0;
        const today = new Date();
        // Start from yesterday if today not yet checked in, else from today
        const todayStr = todayISO();
        const checkedToday = Array.isArray(data.checkins[todayStr]) &&
            data.checkins[todayStr].includes(habit.id);

        let cursor = new Date(today);
        if (!checkedToday) cursor.setDate(cursor.getDate() - 1);

        // Walk backwards counting consecutive days with checkin
        for (let i = 0; i < 365; i++) {
            const dateStr = cursor.toISOString().slice(0, 10);
            const done = Array.isArray(data.checkins[dateStr]) &&
                data.checkins[dateStr].includes(habit.id);
            if (!done) break;
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        // Add today if checked in
        if (checkedToday && streak === 0) streak = 1;
        else if (checkedToday) streak++;  // today extends the backward streak

        result[habit.id] = streak;
    }
    return result;
}

// Returns completion stats per habit for last N days
function getStats(days = 30) {
    const data = loadRaw();
    const activeHabits = data.habits.filter((h) => !h.archived);
    const streaks = getStreaks();
    const stats = [];

    for (const habit of activeHabits) {
        let completed = 0;
        const cursor = new Date();
        cursor.setDate(cursor.getDate() - days + 1);
        for (let i = 0; i < days; i++) {
            const dateStr = cursor.toISOString().slice(0, 10);
            if (Array.isArray(data.checkins[dateStr]) && data.checkins[dateStr].includes(habit.id)) {
                completed++;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        // Best streak: max consecutive
        let best = 0, cur = 0;
        const allDates = Object.keys(data.checkins).sort();
        for (const d of allDates) {
            if (Array.isArray(data.checkins[d]) && data.checkins[d].includes(habit.id)) {
                cur++;
                if (cur > best) best = cur;
            } else {
                cur = 0;
            }
        }
        stats.push({
            id: habit.id,
            name: habit.name,
            emoji: habit.emoji,
            streak: streaks[habit.id] || 0,
            bestStreak: best,
            completedLast7: 0, // filled below
            completedLast30: completed,
            rateLast7: 0,
            rateLast30: Math.round((completed / days) * 100),
        });
    }
    // Fill 7-day stats
    for (const s of stats) {
        let c7 = 0;
        const c = new Date();
        c.setDate(c.getDate() - 6);
        for (let i = 0; i < 7; i++) {
            const d = c.toISOString().slice(0, 10);
            if (Array.isArray(data.checkins[d]) && data.checkins[d].includes(s.id)) c7++;
            c.setDate(c.getDate() + 1);
        }
        s.completedLast7 = c7;
        s.rateLast7 = Math.round((c7 / 7) * 100);
    }
    return stats;
}

module.exports = { getAll, addHabit, updateHabit, removeHabit, checkin, getStreaks, getStats };
