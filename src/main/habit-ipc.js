// OLE OS — Habit IPC Bridge
// Handlers: habit:get-all, habit:add, habit:remove, habit:checkin
// Broadcasts 'habit:updated' nach jeder Mutation.

const { ipcMain } = require('electron');
const store = require('./habit-store.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow) {
    const emit = (returnValue) => {
        broadcast(getWindow(), 'habit:updated', store.getAll());
        return returnValue;
    };

    ipcMain.handle('habit:get-all', () => store.getAll());

    ipcMain.handle('habit:add', (_e, partial) => emit(store.addHabit(partial)));

    ipcMain.handle('habit:update', (_e, { id, patch } = {}) => emit(store.updateHabit(id, patch)));

    ipcMain.handle('habit:remove', (_e, { id } = {}) => emit(store.removeHabit(id)));

    ipcMain.handle('habit:checkin', (_e, { id, date, done } = {}) =>
        emit(store.checkin(id, date, done))
    );
}

module.exports = { init };
