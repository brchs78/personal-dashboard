const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('oleAPI', {
    hideWindow: () => ipcRenderer.send('hide-window'),
    onRoutine: (cb) => ipcRenderer.on('routine-trigger', (_e, id) => cb(id)),
})