// OLE OS — Calendar Store
// Persistiert iCal-Subscriptions, deren letzten Snapshot und vom Coach
// angelegte interne Events in 3 JSON-Dateien unter userData/.
//   calendar-subscriptions.json — Liste der eingetragenen iCal-Quellen
//   calendar-cache.json         — Letzter erfolgreicher Snapshot pro Subscription
//   calendar-internal.json      — Coach-erstellte Events (single-instance)

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function p(name) {
    return path.join(app.getPath('userData'), name);
}

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.warn('[calendar-store] read failed', file, e?.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn('[calendar-store] write failed', file, e?.message);
    }
}

// ── Subscriptions ─────────────────────────────────────────────────
function loadSubscriptions() {
    const data = readJSON(p('calendar-subscriptions.json'), { items: [] });
    return Array.isArray(data.items) ? data.items : [];
}

function saveSubscriptions(items) {
    writeJSON(p('calendar-subscriptions.json'), { items });
}

function addSubscription({ label, url } = {}) {
    const items = loadSubscriptions();
    const u = String(url || '').trim();
    if (!u) throw new Error('missing_url');
    if (items.some((s) => s.url === u)) throw new Error('duplicate_url');
    const sub = {
        id: crypto.randomUUID(),
        label: String(label || '').trim() || 'Kalender',
        url: u,
        addedAt: new Date().toISOString(),
        lastFetchedAt: null,
        lastError: null,
    };
    items.push(sub);
    saveSubscriptions(items);
    return sub;
}

function updateSubscriptionMeta(id, patch) {
    const items = loadSubscriptions();
    const idx = items.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    items[idx] = { ...items[idx], ...patch };
    saveSubscriptions(items);
    return items[idx];
}

function removeSubscription(id) {
    const items = loadSubscriptions().filter((s) => s.id !== id);
    saveSubscriptions(items);
    const cache = loadCache();
    if (cache[id]) {
        delete cache[id];
        saveCache(cache);
    }
    return { ok: true };
}

// ── Cache (Snapshot pro Subscription) ─────────────────────────────
function loadCache() {
    return readJSON(p('calendar-cache.json'), {});
}

function saveCache(cache) {
    writeJSON(p('calendar-cache.json'), cache);
}

function setSubscriptionEvents(subId, events) {
    const cache = loadCache();
    cache[subId] = { events, savedAt: new Date().toISOString() };
    saveCache(cache);
}

function getSubscriptionEvents(subId) {
    const cache = loadCache();
    return cache[subId]?.events || [];
}

function getAllSubscriptionEvents() {
    const cache = loadCache();
    const out = [];
    for (const k of Object.keys(cache)) {
        if (Array.isArray(cache[k]?.events)) out.push(...cache[k].events);
    }
    return out;
}

// ── Internal Events ───────────────────────────────────────────────
function loadInternal() {
    const data = readJSON(p('calendar-internal.json'), { items: [] });
    return Array.isArray(data.items) ? data.items : [];
}

function saveInternal(items) {
    writeJSON(p('calendar-internal.json'), { items });
}

function normalizeInternal(partial = {}) {
    const title = String(partial.title || '').trim() || 'Neuer Termin';
    const start = partial.start ? new Date(partial.start).toISOString() : new Date().toISOString();
    let end;
    if (partial.end) {
        end = new Date(partial.end).toISOString();
    } else {
        // Default 60 min Dauer
        end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    }
    return {
        title,
        start,
        end,
        allDay: !!partial.allDay,
        location: String(partial.location || ''),
        description: String(partial.description || ''),
    };
}

function addInternalEvent(partial = {}) {
    const items = loadInternal();
    const norm = normalizeInternal(partial);
    const ev = {
        id: crypto.randomUUID(),
        ...norm,
        source: 'internal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    items.push(ev);
    saveInternal(items);
    return ev;
}

function updateInternalEvent(id, patch = {}) {
    const items = loadInternal();
    const idx = items.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const cur = items[idx];
    const next = { ...cur };
    if (patch.title !== undefined) next.title = String(patch.title).trim() || cur.title;
    if (patch.start !== undefined) next.start = new Date(patch.start).toISOString();
    if (patch.end !== undefined) next.end = new Date(patch.end).toISOString();
    if (patch.allDay !== undefined) next.allDay = !!patch.allDay;
    if (patch.location !== undefined) next.location = String(patch.location);
    if (patch.description !== undefined) next.description = String(patch.description);
    next.updatedAt = new Date().toISOString();
    items[idx] = next;
    saveInternal(items);
    return next;
}

function deleteInternalEvent(id) {
    const items = loadInternal();
    const before = items.length;
    const next = items.filter((e) => e.id !== id);
    if (next.length === before) return { ok: false, reason: 'not_found' };
    saveInternal(next);
    return { ok: true };
}

function findInternalEvent(id) {
    return loadInternal().find((e) => e.id === id) || null;
}

// ── Merged View ────────────────────────────────────────────────────
function loadAllEvents() {
    const internal = loadInternal();
    const subs = getAllSubscriptionEvents();
    return [...internal, ...subs];
}

function loadAllForRange(fromISO, toISO) {
    const from = fromISO ? new Date(fromISO).getTime() : -Infinity;
    const to = toISO ? new Date(toISO).getTime() : Infinity;
    return loadAllEvents().filter((ev) => {
        const s = new Date(ev.start).getTime();
        const e = new Date(ev.end).getTime();
        return e >= from && s <= to;
    });
}

module.exports = {
    // Subscriptions
    loadSubscriptions,
    addSubscription,
    updateSubscriptionMeta,
    removeSubscription,
    // Cache
    setSubscriptionEvents,
    getSubscriptionEvents,
    getAllSubscriptionEvents,
    // Internal
    loadInternal,
    addInternalEvent,
    updateInternalEvent,
    deleteInternalEvent,
    findInternalEvent,
    // Merged
    loadAllEvents,
    loadAllForRange,
};
