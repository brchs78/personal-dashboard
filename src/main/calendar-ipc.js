// OLE OS — Calendar IPC Bridge
// Handlers: calendar:list, calendar:refresh-now,
//           calendar:list-subs, calendar:add-sub, calendar:remove-sub,
//           calendar:add-internal, calendar:update-internal, calendar:delete-internal
// Broadcasts: calendar:updated (komplette Snapshot-Payload)

const { ipcMain } = require('electron');
const store = require('./calendar-store.js');
const caldav = require('./calendar-caldav.js');
const { CalendarSync } = require('./calendar-sync.js');

let _sync = null;

function snapshot() {
    return {
        subscriptions: store.loadSubscriptions(),
        events: store.loadAllEvents(),
        caldav: store.loadCalDAVAccount(),
    };
}

function broadcast(win) {
    if (win && !win.isDestroyed()) {
        win.webContents.send('calendar:updated', snapshot());
    }
}

function init(getWindow) {
    const broadcastCalendar = () => broadcast(getWindow());

    _sync = new CalendarSync({ onUpdated: broadcastCalendar });
    _sync.start();

    ipcMain.handle('calendar:list', () => snapshot());

    ipcMain.handle('calendar:refresh-now', async () => {
        await _sync.refreshAll();
        return snapshot();
    });

    ipcMain.handle('calendar:list-subs', () => store.loadSubscriptions());

    ipcMain.handle('calendar:add-sub', async (_e, { label, url } = {}) => {
        const sub = store.addSubscription({ label, url });
        // Sofort initialen Fetch antriggern
        try {
            await _sync.refreshOne(sub);
        } catch (e) {
            const msg = String(e?.message || e);
            store.updateSubscriptionMeta(sub.id, {
                lastFetchedAt: new Date().toISOString(),
                lastError: msg,
            });
        }
        broadcastCalendar();
        return snapshot();
    });

    ipcMain.handle('calendar:remove-sub', (_e, id) => {
        store.removeSubscription(id);
        broadcastCalendar();
        return snapshot();
    });

    // ── Event-Schreiben (Routing: CalDAV wenn verbunden+Ziel, sonst internal) ──
    function caldavWriteEnabled() {
        const a = store.loadCalDAVAccount();
        return a.connected && !!a.targetCalendarUrl;
    }

    ipcMain.handle('calendar:add-internal', async (_e, partial) => {
        let ev;
        if (caldavWriteEnabled()) {
            ev = await caldav.createEvent(partial || {});
            await _sync.refreshCalDAV();
        } else {
            ev = store.addInternalEvent(partial);
        }
        broadcastCalendar();
        return ev;
    });

    ipcMain.handle('calendar:update-internal', async (_e, { id, patch, event } = {}) => {
        let ev;
        const src = event || store.findCalDAVEvent(id);
        if (src && src.source === 'caldav') {
            ev = await caldav.updateEvent(src, patch || {});
            await _sync.refreshCalDAV();
        } else if (src && src.source === 'subscription') {
            throw new Error('event_is_read_only_subscription');
        } else {
            ev = store.updateInternalEvent(id, patch || {});
        }
        broadcastCalendar();
        return ev;
    });

    ipcMain.handle('calendar:delete-internal', async (_e, payload) => {
        // payload kann eine ID (internal) oder ein Event-Objekt (caldav) sein
        const id = typeof payload === 'string' ? payload : payload?.id;
        const event = typeof payload === 'object' ? payload : store.findCalDAVEvent(id);
        let r;
        if (event && event.source === 'caldav') {
            r = await caldav.deleteEvent(event);
            await _sync.refreshCalDAV();
        } else if (event && event.source === 'subscription') {
            throw new Error('event_is_read_only_subscription');
        } else {
            r = store.deleteInternalEvent(id);
        }
        broadcastCalendar();
        return r;
    });

    // ── CalDAV (iCloud) ───────────────────────────────────────────────
    ipcMain.handle('calendar:caldav-status', () => store.loadCalDAVAccount());

    ipcMain.handle('calendar:caldav-connect', async (_e, { appleId, password } = {}) => {
        if (!appleId || !password) throw new Error('missing_credentials');
        // Erst Creds validieren + Kalenderliste holen, dann persistieren.
        const calendars = await caldav.probeAndListCalendars(appleId, password);
        store.saveCalDAVAccount({ appleId, password });
        store.updateCalDAVAccountMeta({ calendars });
        await _sync.refreshCalDAV();
        broadcastCalendar();
        return store.loadCalDAVAccount();
    });

    ipcMain.handle('calendar:caldav-disconnect', () => {
        store.disconnectCalDAV();
        broadcastCalendar();
        return { ok: true };
    });

    ipcMain.handle('calendar:caldav-list-calendars', async () => {
        const account = store.loadCalDAVAccount();
        if (!account.connected) throw new Error('caldav_not_connected');
        const password = store.getCalDAVPassword();
        if (!password) throw new Error('caldav_password_unavailable');
        const calendars = await caldav.probeAndListCalendars(account.appleId, password);
        store.updateCalDAVAccountMeta({ calendars });
        return store.loadCalDAVAccount();
    });

    ipcMain.handle('calendar:caldav-set-visible', async (_e, selectedCalendars) => {
        store.updateCalDAVAccountMeta({
            selectedCalendars: Array.isArray(selectedCalendars) ? selectedCalendars : [],
        });
        await _sync.refreshCalDAV();
        broadcastCalendar();
        return store.loadCalDAVAccount();
    });

    ipcMain.handle('calendar:caldav-set-target', (_e, targetCalendarUrl) => {
        store.updateCalDAVAccountMeta({ targetCalendarUrl: targetCalendarUrl || null });
        return store.loadCalDAVAccount();
    });
}

function getSync() {
    return _sync;
}

module.exports = { init, getSync };
