// OLE OS — Routine Store (Morgen-/Abendroutine)
// Persistiert Routinen in userData/routines.json.
// Zeiten werden NICHT gespeichert, sondern aus wakeTime + Dauern berechnet.
// direction 'forward' (Morgen): wakeTime = Startanker
// direction 'backward' (Abend): wakeTime = Endanker (Schlafenszeit)

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function routinesPath() {
    return path.join(app.getPath('userData'), 'routines.json');
}

// Spezialregeln als Offset-Minuten ab Routine-Startzeit.
const SPECIAL_RULES = {
    morning: [
        { id: 'no-phone', emoji: '📵', label: 'Kein Handy', mode: 'until', offset: 30 },
        { id: 'coffee', emoji: '☕', label: 'Kaffee', mode: 'from', offset: 90 },
        { id: 'monday-review', emoji: '📅', label: 'Wochenvorschau', mode: 'mondayUntil', offset: 100 },
    ],
    evening: [
        { id: 'screens-off', emoji: '📵', label: 'Bildschirme aus', mode: 'fromStart', offset: 0 },
        { id: 'white-noise', emoji: '🔇', label: 'White Noise', mode: 'fromStart', offset: 45 },
        { id: 'bedroom-temp', emoji: '❄️', label: 'Schlafzimmer 18–20°C', mode: 'static' },
        { id: 'no-caffeine', emoji: '☕', label: 'Kein Koffein', mode: 'fixed', fixedTime: '14:00' },
    ],
};

// Seed: Morgenroutine als reine Dauer-Liste (Startzeiten werden berechnet).
function morningDefault() {
    const steps = [
        { label: 'Aufwachen – kein Snooze', duration: 0, category: 'Routine', note: 'Feste Zeit, auch am Wochenende' },
        { label: 'Großes Glas Wasser', duration: 2, category: 'Ernährung', note: 'Direkt nach dem Aufstehen' },
        { label: 'Bett machen & Fenster öffnen', duration: 5, category: 'Routine', note: 'Zwei Mini-Wins zum Start' },
        { label: 'Stretching & Mobility', duration: 15, category: 'Körper', note: 'Gelenke, Hüfte und Rücken lockern' },
        { label: 'Duschen & Fertig machen', duration: 25, category: 'Körper', note: 'Inkl. Zähne putzen und anziehen' },
        { label: 'Porridge zubereiten', duration: 5, category: 'Ernährung', note: '5 Minuten reichen völlig' },
        { label: 'Frühstück – bewusst essen', duration: 13, category: 'Ernährung', note: 'Kein Handy, keine Ablenkung' },
        { label: 'Küche aufräumen', duration: 5, category: 'Routine', note: 'Saubere Basis für den Tag' },
        { label: 'Tagesplanung & Top-3', duration: 10, category: 'Mentales', note: 'Drei wichtigste Aufgaben' },
        { label: 'Visualisierung der Tagesziele', duration: 5, category: 'Mentales', note: 'Wie sieht ein guter Tag aus?' },
    ];
    return {
        direction: 'forward',
        wakeTime: '06:30',
        steps: steps.map((s) => ({ id: crypto.randomUUID(), ...s })),
    };
}

// Seed: Abendroutine — wakeTime = Schlafenszeit (Endanker), Zeiten rückwärts.
function eveningDefault() {
    const steps = [
        { label: 'Bildschirme aus – Routine startet', duration: 0, category: 'Routine', note: '80 Min vor dem Schlafen, kein Handy, kein Laptop' },
        { label: 'Tagesreview & Morgen-To-Do', duration: 15, category: 'Mentales', note: 'Was lief gut? Was nicht? 3 Prioritäten für morgen' },
        { label: 'Yin Yoga', duration: 15, category: 'Körper', note: 'Ruhiges, entspannendes Yoga zum Runterkommen' },
        { label: 'Dinge im Bad erledigen', duration: 15, category: 'Pflege', note: 'Zähne putzen, Hautpflege, abendliche Hygiene' },
        { label: 'Schlafzimmer vorbereiten', duration: 5, category: 'Routine', note: 'Temperatur 18–20°C, Vorhänge, White Noise starten' },
        { label: 'Lesen (kein Screen)', duration: 30, category: 'Lernen', note: 'Buch – kein Handy, kein Tablet, kein E-Reader mit Blaulicht' },
    ];
    return {
        direction: 'backward',
        wakeTime: '22:20',
        steps: steps.map((s) => ({ id: crypto.randomUUID(), ...s })),
    };
}

function emptyState() {
    return { routines: { morning: morningDefault(), evening: eveningDefault() } };
}

function loadRaw() {
    try {
        const p = routinesPath();
        if (!fs.existsSync(p)) return emptyState();
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const routines = (data.routines && typeof data.routines === 'object') ? data.routines : {};
        // Fehlende Routinen nachseeden
        if (!routines.morning || !Array.isArray(routines.morning.steps)) {
            routines.morning = morningDefault();
        }
        if (!routines.evening || !Array.isArray(routines.evening.steps)) {
            routines.evening = eveningDefault();
        }
        // direction migrieren (ältere Datenstände ohne direction-Feld)
        if (!routines.morning.direction) routines.morning.direction = 'forward';
        if (!routines.evening.direction) routines.evening.direction = 'backward';
        return { routines };
    } catch (e) {
        console.warn('[routine-store] load failed, resetting:', e?.message);
        return emptyState();
    }
}

function saveRaw(data) {
    fs.writeFileSync(routinesPath(), JSON.stringify(data, null, 2));
}

// Negative-safe: "22:20" + (-80) → "21:00"
function addMinutes(time, minutes) {
    const [h, m] = String(time).split(':').map((n) => parseInt(n, 10));
    const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function isValidTime(time) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time));
}

function getAll() {
    return loadRaw();
}

function setWakeTime(routineId, time) {
    const data = loadRaw();
    if (data.routines[routineId] && isValidTime(time)) {
        data.routines[routineId].wakeTime = time;
        saveRaw(data);
    }
    return data;
}

// Ersetzt die Schritt-Liste (für späteres Editing / weitere Routinen).
function updateSteps(routineId, steps) {
    const data = loadRaw();
    if (data.routines[routineId] && Array.isArray(steps)) {
        data.routines[routineId].steps = steps.map((s) => ({
            id: s.id || crypto.randomUUID(),
            label: String(s.label || '').trim(),
            duration: Math.max(0, parseInt(s.duration, 10) || 0),
            category: String(s.category || 'Routine'),
            note: String(s.note || ''),
        }));
        saveRaw(data);
    }
    return data;
}

// Berechnet Startzeiten je Schritt + Gesamtdauer/Endzeit + Spezialregel-Zeiten.
// forward: wakeTime = Startanker → endTime = wakeTime + total
// backward: wakeTime = Endanker (Schlafenszeit) → startAnchor = wakeTime - total
function computeSchedule(routineId) {
    const data = loadRaw();
    const routine = data.routines[routineId];
    if (!routine) return null;
    const direction = routine.direction || (routineId === 'evening' ? 'backward' : 'forward');
    const totalDuration = routine.steps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const startAnchor = direction === 'backward'
        ? addMinutes(routine.wakeTime, -totalDuration)
        : routine.wakeTime;
    let cursor = 0;
    const steps = routine.steps.map((s) => {
        const startTime = addMinutes(startAnchor, cursor);
        cursor += s.duration;
        return { ...s, startTime };
    });
    const endTime = direction === 'backward' ? routine.wakeTime : addMinutes(startAnchor, totalDuration);
    const rules = (SPECIAL_RULES[routineId] || []).map((r) => ({
        ...r,
        time: r.mode === 'static' ? null
            : r.mode === 'fixed' ? r.fixedTime
            : addMinutes(startAnchor, r.offset),
    }));
    return { direction, wakeTime: routine.wakeTime, startTime: startAnchor, steps, totalDuration, endTime, rules };
}

module.exports = { getAll, setWakeTime, updateSteps, computeSchedule, addMinutes, SPECIAL_RULES };
