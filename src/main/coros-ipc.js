// OLE OS — COROS IPC Bridge
// Handlers: status / connect / disconnect / get-summary / get-trends / refresh
// Events:   coros:status, coros:ready

const { ipcMain } = require('electron');
const client = require('./coros-client.js');
const store = require('./coros-store.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function status() {
    const connected = store.isConnected();
    const cache = connected ? store.loadCache() : null;
    return {
        connected,
        syncedAt: cache?.meta?.syncedAt || null,
    };
}

function init(getWindow) {
    ipcMain.handle('coros:status', () => status());

    ipcMain.handle('coros:connect', async () => {
        await client.connect();
        const s = status();
        broadcast(getWindow(), 'coros:status', s);
        // Direkt nach Verbindung einen ersten Snapshot ziehen.
        try {
            const snapshot = await client.getHealthSnapshot();
            broadcast(getWindow(), 'coros:ready', { syncedAt: snapshot?.meta?.syncedAt || null });
        } catch (e) {
            console.warn('[coros-ipc] initial snapshot failed:', e?.message);
        }
        return status();
    });

    ipcMain.handle('coros:disconnect', async () => {
        await client.disconnect();
        const s = status();
        broadcast(getWindow(), 'coros:status', s);
        return s;
    });

    ipcMain.handle('coros:get-summary', () => {
        const cache = store.loadCache();
        return cache || null;
    });

    ipcMain.handle('coros:get-trends', (_e, { metric, days = 30 } = {}) => {
        const cache = store.loadCache();
        const trends = cache?.trends || {};
        if (metric) return trends[metric] || [];
        return trends;
    });

    ipcMain.handle('coros:refresh', async () => {
        const snapshot = await client.getHealthSnapshot();
        broadcast(getWindow(), 'coros:ready', { syncedAt: snapshot?.meta?.syncedAt || null });
        return { ok: true, syncedAt: snapshot?.meta?.syncedAt || null };
    });
}

module.exports = { init };
