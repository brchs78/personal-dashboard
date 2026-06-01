// OLE OS — Calendar IPC Bridge
// Handlers: calendar:list, calendar:refresh-now,
//           calendar:list-subs, calendar:add-sub, calendar:remove-sub,
//           calendar:add-internal, calendar:update-internal, calendar:delete-internal
// Broadcasts: calendar:updated (komplette Snapshot-Payload)

const { ipcMain } = require('electron');
const store = require('./calendar-store.js');
const { CalendarSync } = require('./calendar-sync.js');

let _sync = null;

function snapshot() {
    return {
        subscriptions: store.loadSubscriptions(),
        events: store.loadAllEvents(),
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

    ipcMain.handle('calendar:add-internal', (_e, partial) => {
        const ev = store.addInternalEvent(partial);
        broadcastCalendar();
        return ev;
    });

    ipcMain.handle('calendar:update-internal', (_e, { id, patch } = {}) => {
        const ev = store.updateInternalEvent(id, patch || {});
        broadcastCalendar();
        return ev;
    });

    ipcMain.handle('calendar:delete-internal', (_e, id) => {
        const r = store.deleteInternalEvent(id);
        broadcastCalendar();
        return r;
    });
}

function getSync() {
    return _sync;
}

module.exports = { init, getSync };
