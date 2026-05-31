const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('oleAPI', {
    hideWindow: () => ipcRenderer.send('hide-window'),
    onRoutine: (cb) => ipcRenderer.on('routine-trigger', (_e, id) => cb(id)),
    health: {
        getSummary: () => ipcRenderer.invoke('health:get-summary'),
        getTrends:  (metric, days) => ipcRenderer.invoke('health:get-trends', metric, days),
        refresh:    () => ipcRenderer.invoke('health:refresh'),
        onReady:    (cb) => ipcRenderer.on('health:ready', (_e, payload) => cb(payload)),
        onProgress: (cb) => ipcRenderer.on('health:progress', (_e, payload) => cb(payload)),
    },
})
