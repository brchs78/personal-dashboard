// OLE OS — Trainingsplan IPC Bridge
// Handlers: plan:get-current, plan:generate, plan:mark-done, plan:clear

const { ipcMain } = require('electron');
const coachPlan = require('./coach-plan.js');
const store = require('./coach-plan-store.js');
const stravaStore = require('./strava-store.js');

let healthGetter = null; // injected: () => { latest, ... }
let healthTrendGetter = null; // injected: (metric, days) => [{date, value}]

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow, { getHealthSummary, getHealthTrend } = {}) {
    healthGetter = getHealthSummary || (() => null);
    healthTrendGetter = getHealthTrend || (() => []);

    ipcMain.handle('plan:get-current', () => ({
        current: store.loadCurrent(),
        done: store.getDone(),
    }));

    ipcMain.handle('plan:generate', async (_e, { apiKey, weekStart } = {}) => {
        const health = healthGetter();
        const hrvTrend = healthTrendGetter('hrv', 7) || [];
        const stravaCache = stravaStore.loadCache();
        const activities = stravaCache?.activities || [];

        const plan = await coachPlan.generatePlan({
            apiKey,
            health,
            hrvTrend,
            activities,
            weekStart,
        });
        store.saveCurrent(plan);
        broadcast(getWindow(), 'plan:updated', { plan });
        return plan;
    });

    ipcMain.handle('plan:mark-done', (_e, { date, done }) => {
        const map = store.markDone(date, done);
        broadcast(getWindow(), 'plan:done-updated', map);
        return map;
    });

    ipcMain.handle('plan:update-day', (_e, { date, patch } = {}) => {
        if (!date) throw new Error('missing_date');
        const plan = store.updateDay(date, patch || {});
        if (!plan) throw new Error('day_not_found');
        broadcast(getWindow(), 'plan:updated', { plan });
        return plan;
    });

    ipcMain.handle('plan:clear', () => {
        store.clear();
        broadcast(getWindow(), 'plan:updated', { plan: null });
        return { ok: true };
    });
}

module.exports = { init };
