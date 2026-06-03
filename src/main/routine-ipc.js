// OLE OS — Routine IPC Bridge
// Handlers: routine:get-all, routine:set-wake-time
// Broadcasts 'routine:updated' nach jeder Mutation.

const { ipcMain } = require('electron');
const store = require('./routine-store.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow) {
    const emit = (returnValue) => {
        broadcast(getWindow(), 'routine:updated', store.getAll());
        return returnValue;
    };

    ipcMain.handle('routine:get-all', () => store.getAll());

    ipcMain.handle('routine:set-wake-time', (_e, { routineId, time } = {}) =>
        emit(store.setWakeTime(routineId, time))
    );
}

module.exports = { init };
