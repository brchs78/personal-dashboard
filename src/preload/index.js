const { contextBridge, ipcRenderer } = require('electron')

// Hilfsfunktion: registriert Listener + gibt Cleanup zurück
function on(channel, cb) {
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('oleAPI', {
    hideWindow: () => ipcRenderer.send('hide-window'),
    onRoutine: (cb) => on('routine-trigger', (id) => cb(id)),
    health: {
        getSummary:   () => ipcRenderer.invoke('health:get-summary'),
        getTrends:    (metric, days) => ipcRenderer.invoke('health:get-trends', metric, days),
        refresh:      () => ipcRenderer.invoke('health:refresh'),
        sourceStatus: () => ipcRenderer.invoke('health:source-status'),
        onReady:      (cb) => on('health:ready', cb),
        onProgress:   (cb) => on('health:progress', cb),
    },
    strava: {
        status:         () => ipcRenderer.invoke('strava:status'),
        connect:        () => ipcRenderer.invoke('strava:connect'),
        disconnect:     () => ipcRenderer.invoke('strava:disconnect'),
        listActivities: (opts) => ipcRenderer.invoke('strava:list-activities', opts),
        sync:           (opts) => ipcRenderer.invoke('strava:sync', opts),
        getActivity:    (id) => ipcRenderer.invoke('strava:get-activity', id),
        onStatus:       (cb) => on('strava:status', cb),
        onActivities:   (cb) => on('strava:activities', cb),
    },
    plan: {
        getCurrent:    () => ipcRenderer.invoke('plan:get-current'),
        generate:      (opts) => ipcRenderer.invoke('plan:generate', opts),
        markDone:      (date, done) => ipcRenderer.invoke('plan:mark-done', { date, done }),
        updateDay:     (date, patch) => ipcRenderer.invoke('plan:update-day', { date, patch }),
        clear:         () => ipcRenderer.invoke('plan:clear'),
        onUpdated:     (cb) => on('plan:updated', cb),
        onDoneUpdated: (cb) => on('plan:done-updated', cb),
    },
    todo: {
        getAll:     () => ipcRenderer.invoke('todo:get-all'),
        add:        (partial)     => ipcRenderer.invoke('todo:add', partial),
        update:     (id, patch)   => ipcRenderer.invoke('todo:update', { id, patch }),
        remove:     (id)          => ipcRenderer.invoke('todo:remove', id),
        toggleDone: (id)          => ipcRenderer.invoke('todo:toggle', id),
        reorder:    (orderedIds)  => ipcRenderer.invoke('todo:reorder', orderedIds),
        migrate:    (legacyItems) => ipcRenderer.invoke('todo:migrate', legacyItems),
        onUpdated:  (cb) => on('todo:updated', cb),
    },
    routine: {
        getAll:      ()                  => ipcRenderer.invoke('routine:get-all'),
        setWakeTime: (routineId, time)   => ipcRenderer.invoke('routine:set-wake-time', { routineId, time }),
        onUpdated:   (cb) => on('routine:updated', cb),
    },
    habit: {
        getAll:    ()                      => ipcRenderer.invoke('habit:get-all'),
        add:       (partial)               => ipcRenderer.invoke('habit:add', partial),
        update:    ({ id, patch })         => ipcRenderer.invoke('habit:update', { id, patch }),
        remove:    ({ id })                => ipcRenderer.invoke('habit:remove', { id }),
        checkin:   ({ id, date, done })    => ipcRenderer.invoke('habit:checkin', { id, date, done }),
        onUpdated: (cb) => on('habit:updated', cb),
    },
    coach: {
        send:             ({ apiKey, userMessage }) => ipcRenderer.invoke('coach:send', { apiKey, userMessage }),
        clear:            () => ipcRenderer.invoke('coach:clear'),
        getHistory:       () => ipcRenderer.invoke('coach:get-history'),
        onHistoryUpdated: (cb) => on('coach:history-updated', cb),
        onToolEvent:      (cb) => on('coach:tool-event', cb),
        onStreamDelta:    (cb) => on('coach:stream-delta', cb),
        onStreamReset:    (cb) => on('coach:stream-reset', cb),
    },
    vault: {
        getSettings:    () => ipcRenderer.invoke('vault:get-settings'),
        setPath:        () => ipcRenderer.invoke('vault:set-path'),
        setAutoExport:  (enabled) => ipcRenderer.invoke('vault:set-auto-export', enabled),
        setExportCoach: (enabled) => ipcRenderer.invoke('vault:set-export-coach', enabled),
        exportDay:      (date) => ipcRenderer.invoke('vault:export-day', date),
        exportToday:    () => ipcRenderer.invoke('vault:export-today'),
        exportRange:    (from, to) => ipcRenderer.invoke('vault:export-range', { from, to }),
        onUpdated:      (cb) => on('vault:updated', cb),
    },
    calendar: {
        list:           () => ipcRenderer.invoke('calendar:list'),
        refreshNow:     () => ipcRenderer.invoke('calendar:refresh-now'),
        listSubs:       () => ipcRenderer.invoke('calendar:list-subs'),
        addSub:         ({ label, url }) => ipcRenderer.invoke('calendar:add-sub', { label, url }),
        removeSub:      (id) => ipcRenderer.invoke('calendar:remove-sub', id),
        addInternal:    (partial) => ipcRenderer.invoke('calendar:add-internal', partial),
        updateInternal: (id, patch, event) => ipcRenderer.invoke('calendar:update-internal', { id, patch, event }),
        deleteInternal: (idOrEvent) => ipcRenderer.invoke('calendar:delete-internal', idOrEvent),
        onUpdated:      (cb) => on('calendar:updated', cb),
        caldav: {
            status:        () => ipcRenderer.invoke('calendar:caldav-status'),
            connect:       ({ appleId, password }) => ipcRenderer.invoke('calendar:caldav-connect', { appleId, password }),
            disconnect:    () => ipcRenderer.invoke('calendar:caldav-disconnect'),
            listCalendars: () => ipcRenderer.invoke('calendar:caldav-list-calendars'),
            setVisible:    (urls) => ipcRenderer.invoke('calendar:caldav-set-visible', urls),
            setTarget:     (url) => ipcRenderer.invoke('calendar:caldav-set-target', url),
        },
    },
})
