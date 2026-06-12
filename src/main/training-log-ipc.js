// OLE OS — Training-Log IPC Bridge
// Handlers: traininglog:get (date), traininglog:set ({date,patch}),
//           traininglog:recent-niggles (days).
// Broadcastet 'traininglog:updated' nach jeder Mutation.

const { ipcMain } = require('electron');
const store = require('./training-log-store.js');

function init(getWindow) {
    const broadcast = () => {
        const w = getWindow();
        if (w && !w.isDestroyed()) w.webContents.send('traininglog:updated');
    };

    ipcMain.handle('traininglog:get', (_e, date) => store.getEntry(date));
    ipcMain.handle('traininglog:set', (_e, { date, patch } = {}) => {
        const r = store.setEntry(date, patch);
        broadcast();
        return r;
    });
    ipcMain.handle('traininglog:recent-niggles', (_e, days) => store.recentNiggles(days));
}

module.exports = { init };
