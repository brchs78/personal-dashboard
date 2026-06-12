// OLE OS — Training-Log Store (RPE + Beine + Niggles)
// Subjektives Feedback pro Tag: Anstrengung (RPE 1–10), Beingefühl, Niggles
// (Wehwehchen mit Körperregion + Schwere). Persistiert in userData/training-log.json.
// Niggles sind der beste Verletzungs-Frühwarner — werden im Morgen-Briefing gespiegelt.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { todayISO, daysAgo } = require('./utils/date.js');

function logPath() {
    return path.join(app.getPath('userData'), 'training-log.json');
}

function loadRaw() {
    try {
        const p = logPath();
        if (!fs.existsSync(p)) return { entries: {} };
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { entries: (data.entries && typeof data.entries === 'object') ? data.entries : {} };
    } catch (e) {
        console.warn('[training-log] load failed, resetting:', e?.message);
        return { entries: {} };
    }
}

function saveRaw(data) {
    try {
        fs.writeFileSync(logPath(), JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn('[training-log] save failed:', e?.message);
        throw new Error(`training_log_save_failed: ${e?.message || e}`);
    }
}

function clampRpe(v) {
    if (v == null || v === '') return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.min(10, n));
}

const LEGS = ['fresh', 'normal', 'heavy', null];

function normalizeNiggle(raw = {}) {
    const sev = Math.round(Number(raw.severity));
    return {
        area: String(raw.area || '').slice(0, 40),
        severity: Math.max(1, Math.min(3, Number.isFinite(sev) ? sev : 1)),
        note: String(raw.note || '').slice(0, 200),
    };
}

function normalizeEntry(raw = {}) {
    const niggles = Array.isArray(raw.niggles) ? raw.niggles : [];
    return {
        rpe: clampRpe(raw.rpe),
        legs: LEGS.includes(raw.legs) ? raw.legs : null,
        niggles: niggles.filter((n) => n && n.area).map(normalizeNiggle),
        note: String(raw.note || ''),
        updatedAt: raw.updatedAt || null,
    };
}

function getEntry(date) {
    const d = date || todayISO();
    const data = loadRaw();
    return { date: d, ...normalizeEntry(data.entries[d]) };
}

function setEntry(date, patch = {}) {
    const d = date || todayISO();
    const data = loadRaw();
    const merged = normalizeEntry({ ...normalizeEntry(data.entries[d]), ...patch });
    merged.updatedAt = new Date().toISOString();
    data.entries[d] = merged;
    saveRaw(data);
    return { date: d, ...merged };
}

// Offene Niggles der letzten N Tage (flach, mit Datum). Frühwarner fürs Briefing.
function recentNiggles(days = 14) {
    const data = loadRaw();
    const out = [];
    for (const [date, raw] of Object.entries(data.entries)) {
        const age = daysAgo(date);
        if (age == null || age < 0 || age > days) continue;
        const entry = normalizeEntry(raw);
        for (const n of entry.niggles) out.push({ ...n, date, age });
    }
    return out.sort((a, b) => a.age - b.age);
}

module.exports = { getEntry, setEntry, recentNiggles };
