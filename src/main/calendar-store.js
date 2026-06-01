// OLE OS — Calendar Store
// Persistiert iCal-Subscriptions, deren letzten Snapshot und vom Coach
// angelegte interne Events in 3 JSON-Dateien unter userData/.
//   calendar-subscriptions.json — Liste der eingetragenen iCal-Quellen
//   calendar-cache.json         — Letzter erfolgreicher Snapshot pro Subscription
//   calendar-internal.json      — Coach-erstellte Events (single-instance)

const { app, safeStorage } = require('electron');
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

// ── CalDAV Account (iCloud) ───────────────────────────────────────
// Apple-ID + App-spezifisches Passwort. Passwort wird via safeStorage
// (macOS Keychain) verschlüsselt persistiert — nie im Klartext.

function accountPath() {
    return p('calendar-caldav-account.json');
}

function loadCalDAVAccountRaw() {
    return readJSON(accountPath(), null);
}

// Öffentliche Sicht — OHNE Passwort. Für IPC/Renderer.
function loadCalDAVAccount() {
    const a = loadCalDAVAccountRaw();
    if (!a) return { connected: false };
    return {
        connected: !!a.connected,
        appleId: a.appleId || '',
        calendars: Array.isArray(a.calendars) ? a.calendars : [],
        selectedCalendars: Array.isArray(a.selectedCalendars) ? a.selectedCalendars : [],
        targetCalendarUrl: a.targetCalendarUrl || null,
        lastSync: a.lastSync || null,
        lastError: a.lastError || null,
    };
}

// Nur main-intern: Klartext-Passwort entschlüsseln.
function getCalDAVPassword() {
    const a = loadCalDAVAccountRaw();
    if (!a?.passwordEnc) return null;
    try {
        return safeStorage.decryptString(Buffer.from(a.passwordEnc, 'base64'));
    } catch (e) {
        console.warn('[calendar-store] password decrypt failed', e?.message);
        return null;
    }
}

function saveCalDAVAccount({ appleId, password }) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safe_storage_unavailable');
    }
    const enc = safeStorage.encryptString(String(password)).toString('base64');
    const account = {
        appleId: String(appleId || '').trim(),
        passwordEnc: enc,
        connected: true,
        calendars: [],
        selectedCalendars: [],
        targetCalendarUrl: null,
        lastSync: null,
        lastError: null,
    };
    writeJSON(accountPath(), account);
    return loadCalDAVAccount();
}

function updateCalDAVAccountMeta(patch = {}) {
    const a = loadCalDAVAccountRaw();
    if (!a) return { connected: false };
    const next = { ...a, ...patch };
    writeJSON(accountPath(), next);
    return loadCalDAVAccount();
}

function disconnectCalDAV() {
    try { fs.unlinkSync(accountPath()); } catch { /* nicht vorhanden ist ok */ }
    try { fs.unlinkSync(p('calendar-caldav-cache.json')); } catch { /* ok */ }
    return { ok: true };
}

// ── CalDAV Event-Cache (separat von Subscription-Cache) ───────────
function caldavCachePath() {
    return p('calendar-caldav-cache.json');
}

function loadCalDAVCache() {
    return readJSON(caldavCachePath(), {});
}

function saveCalDAVCache(cache) {
    writeJSON(caldavCachePath(), cache);
}

// Cache pro Kalender-URL: { events, ctag, savedAt }
function setCalDAVCalendarEvents(calendarUrl, events, ctag) {
    const cache = loadCalDAVCache();
    cache[calendarUrl] = { events, ctag: ctag || null, savedAt: new Date().toISOString() };
    saveCalDAVCache(cache);
}

function getCalDAVCalendarCtag(calendarUrl) {
    return loadCalDAVCache()[calendarUrl]?.ctag || null;
}

function getAllCalDAVEvents() {
    const cache = loadCalDAVCache();
    const account = loadCalDAVAccount();
    const visible = new Set(account.selectedCalendars || []);
    const out = [];
    for (const url of Object.keys(cache)) {
        if (visible.size && !visible.has(url)) continue;
        if (Array.isArray(cache[url]?.events)) out.push(...cache[url].events);
    }
    return out;
}

function findCalDAVEvent(id) {
    return getAllCalDAVEvents().find((e) => e.id === id) || null;
}

// ── Merged View ────────────────────────────────────────────────────
function loadAllEvents() {
    const internal = loadInternal().map((e) => ({ ...e, writable: true }));
    const subs = getAllSubscriptionEvents();
    const caldav = getAllCalDAVEvents();
    return [...internal, ...subs, ...caldav];
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
    // CalDAV account
    loadCalDAVAccount,
    getCalDAVPassword,
    saveCalDAVAccount,
    updateCalDAVAccountMeta,
    disconnectCalDAV,
    // CalDAV cache
    setCalDAVCalendarEvents,
    getCalDAVCalendarCtag,
    getAllCalDAVEvents,
    findCalDAVEvent,
    // Merged
    loadAllEvents,
    loadAllForRange,
};
