// OLE OS — Debrief Store (Abend-Reflexion + Morgen-Top-3)
// Persistiert pro Datum einen Eintrag in userData/debrief.json.
// Loop: Abends Reflexion + 3 Prioritäten für morgen erfassen → morgens im
// Briefing wieder anzeigen.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { todayISO } = require('./utils/date.js');

function debriefPath() {
    return path.join(app.getPath('userData'), 'debrief.json');
}

function loadRaw() {
    try {
        const p = debriefPath();
        if (!fs.existsSync(p)) return { entries: {} };
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { entries: (data.entries && typeof data.entries === 'object') ? data.entries : {} };
    } catch (e) {
        console.warn('[debrief-store] load failed, resetting:', e?.message);
        return { entries: {} };
    }
}

function saveRaw(data) {
    try {
        fs.writeFileSync(debriefPath(), JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn('[debrief-store] save failed:', e?.message);
        throw new Error(`debrief_save_failed: ${e?.message || e}`);
    }
}

function normalizeEntry(raw = {}) {
    const prios = Array.isArray(raw.tomorrowPriorities) ? raw.tomorrowPriorities : [];
    return {
        wentWell: String(raw.wentWell || ''),
        wentBad: String(raw.wentBad || ''),
        tomorrowPriorities: [0, 1, 2].map((i) => String(prios[i] || '')),
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

module.exports = { getEntry, setEntry };
