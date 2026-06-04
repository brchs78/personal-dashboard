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

    ipcMain.handle('plan:generate', async (_e, { apiKey, weekStart, availableRunDays } = {}) => {
        const health = healthGetter();
        const hrvTrend = healthTrendGetter('hrv', 7) || [];
        const stravaCache = stravaStore.loadCache();
        const activities = stravaCache?.activities || [];
        const prevPlan = store.loadCurrent();
        const history = store.loadHistory();
        const done = store.getDone();

        const plan = await coachPlan.generatePlan({
            apiKey,
            health,
            hrvTrend,
            activities,
            weekStart,
            prevPlan,
            history,
            done,
            availableRunDays,
        });
        store.saveCurrent(plan);
        broadcast(getWindow(), 'plan:updated', { plan });
        return plan;
    });

    ipcMain.handle('plan:recommend-frequency', () => {
        const prevPlan = store.loadCurrent();
        const total = (prevPlan?.days || []).reduce((s, d) => s + (d.distanceKm || 0), 0);
        const weekStart = coachPlan.thisMonday();
        return {
            recommendedRunDays: coachPlan.recommendRunDays(total),
            lastWeeklyKm: Math.round(total),
            phase: coachPlan.computePhase(weekStart),
            weeksToMarathon: coachPlan.weeksToMarathon(weekStart),
        };
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
