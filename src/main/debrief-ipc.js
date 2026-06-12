// OLE OS — Debrief IPC Bridge
// Handlers: debrief:get (optional ISO-Datum, default heute), debrief:set.
// Broadcastet 'debrief:updated' nach jeder Mutation.

const { ipcMain } = require('electron');
const store = require('./debrief-store.js');

function init(getWindow) {
    const broadcast = () => {
        const w = getWindow();
        if (w && !w.isDestroyed()) w.webContents.send('debrief:updated');
    };

    ipcMain.handle('debrief:get', (_e, date) => store.getEntry(date));
    ipcMain.handle('debrief:set', (_e, { date, patch } = {}) => {
        const r = store.setEntry(date, patch);
        broadcast();
        return r;
    });
}

module.exports = { init };
