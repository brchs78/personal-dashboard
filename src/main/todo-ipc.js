// OLE OS — ToDo IPC Bridge
// Handlers: todo:get-all, todo:add, todo:update, todo:remove, todo:toggle, todo:reorder, todo:migrate
// Broadcasts 'todo:updated' nach jeder Mutation.

const { ipcMain } = require('electron');
const store = require('./todo-store.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow) {
    const emit = (returnValue) => {
        broadcast(getWindow(), 'todo:updated', store.loadAll());
        return returnValue;
    };

    ipcMain.handle('todo:get-all', () => store.loadAll());

    ipcMain.handle('todo:add', (_e, partial) => emit(store.add(partial)));

    ipcMain.handle('todo:update', (_e, { id, patch } = {}) =>
        emit(store.update(id, patch))
    );

    ipcMain.handle('todo:remove', (_e, id) => emit(store.remove(id)));

    ipcMain.handle('todo:toggle', (_e, id) => emit(store.toggleDone(id)));

    ipcMain.handle('todo:reorder', (_e, orderedIds) =>
        emit(store.reorder(orderedIds))
    );

    ipcMain.handle('todo:migrate', (_e, legacyItems) =>
        emit(store.migrate(legacyItems))
    );
}

module.exports = { init };
