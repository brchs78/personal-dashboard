// OLE OS — Trainingsplan Cache
// Speichert aktuellen Plan + History + Done-Toggles in userData/training-plan.json

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function planPath() {
    return path.join(app.getPath('userData'), 'training-plan.json');
}

function loadAll() {
    try {
        const p = planPath();
        if (!fs.existsSync(p)) return { current: null, history: [], done: {} };
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.error('[coach-plan-store] load failed:', e);
        return { current: null, history: [], done: {} };
    }
}

function saveAll(data) {
    fs.writeFileSync(planPath(), JSON.stringify(data, null, 2));
}

function loadCurrent() {
    return loadAll().current;
}

function saveCurrent(plan) {
    const all = loadAll();
    if (all.current) {
        all.history = (all.history || []).concat([all.current]).slice(-12);
    }
    all.current = plan;
    saveAll(all);
}

function markDone(date, done) {
    const all = loadAll();
    all.done = all.done || {};
    if (done) all.done[date] = new Date().toISOString();
    else delete all.done[date];
    saveAll(all);
    return all.done;
}

function getDone() {
    return loadAll().done || {};
}

function updateDay(date, patch) {
    const all = loadAll();
    if (!all.current?.days) return null;
    const idx = all.current.days.findIndex((d) => d.date === date);
    if (idx < 0) return null;
    const allowed = ['type', 'title', 'distanceKm', 'durationMin', 'paceTarget', 'hrZone', 'notes'];
    const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
    all.current.days[idx] = { ...all.current.days[idx], ...safe };
    saveAll(all);
    return all.current;
}

function clear() {
    try { fs.unlinkSync(planPath()); } catch {}
}

module.exports = { loadCurrent, saveCurrent, markDone, getDone, updateDay, clear };
