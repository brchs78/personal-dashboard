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
    strava: {
        status:         () => ipcRenderer.invoke('strava:status'),
        connect:        () => ipcRenderer.invoke('strava:connect'),
        disconnect:     () => ipcRenderer.invoke('strava:disconnect'),
        listActivities: (opts) => ipcRenderer.invoke('strava:list-activities', opts),
        sync:           (opts) => ipcRenderer.invoke('strava:sync', opts),
        getActivity:    (id) => ipcRenderer.invoke('strava:get-activity', id),
        onStatus:       (cb) => ipcRenderer.on('strava:status', (_e, payload) => cb(payload)),
        onActivities:   (cb) => ipcRenderer.on('strava:activities', (_e, payload) => cb(payload)),
    },
    plan: {
        getCurrent: () => ipcRenderer.invoke('plan:get-current'),
        generate:   (opts) => ipcRenderer.invoke('plan:generate', opts),
        markDone:   (date, done) => ipcRenderer.invoke('plan:mark-done', { date, done }),
        clear:      () => ipcRenderer.invoke('plan:clear'),
        onUpdated:  (cb) => ipcRenderer.on('plan:updated', (_e, payload) => cb(payload)),
        onDoneUpdated: (cb) => ipcRenderer.on('plan:done-updated', (_e, payload) => cb(payload)),
    },
})
