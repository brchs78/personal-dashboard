// OLE OS — Strava IPC Bridge
// Handlers: status / connect / disconnect / list / sync
// Events:   strava:status, strava:activities

const { ipcMain } = require('electron');
const auth = require('./strava-auth.js');
const client = require('./strava-client.js');
const store = require('./strava-store.js');

function getCreds() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('missing_strava_env');
    return { clientId, clientSecret };
}

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function statusFromTokens() {
    const t = store.loadTokens();
    if (!t) return { connected: false };
    return {
        connected: true,
        athlete: t.athlete ? {
            id: t.athlete.id,
            firstname: t.athlete.firstname,
            lastname: t.athlete.lastname,
            profile: t.athlete.profile,
        } : null,
        expiresAt: t.expires_at,
    };
}

function init(getWindow) {
    ipcMain.handle('strava:status', () => statusFromTokens());

    ipcMain.handle('strava:connect', async () => {
        const creds = getCreds();
        const tokens = await auth.startConnect(creds);
        store.saveTokens(tokens);
        const status = statusFromTokens();
        broadcast(getWindow(), 'strava:status', status);
        return status;
    });

    ipcMain.handle('strava:disconnect', () => {
        store.clearTokens();
        store.clearCache();
        const status = statusFromTokens();
        broadcast(getWindow(), 'strava:status', status);
        return status;
    });

    ipcMain.handle('strava:list-activities', async (_e, opts = {}) => {
        const cache = store.loadCache();
        return {
            activities: cache?.activities || [],
            lastSync: cache?.lastSync || null,
            limit: opts.limit ?? 20,
        };
    });

    ipcMain.handle('strava:sync', async (_e, { perPage = 30 } = {}) => {
        const creds = getCreds();
        const activities = await client.listActivities(creds, { perPage });
        const cache = {
            activities,
            lastSync: new Date().toISOString(),
        };
        store.saveCache(cache);
        broadcast(getWindow(), 'strava:activities', {
            count: activities.length,
            lastSync: cache.lastSync,
        });
        return { ok: true, count: activities.length, lastSync: cache.lastSync };
    });

    ipcMain.handle('strava:get-activity', async (_e, id) => {
        const creds = getCreds();
        return await client.getActivity(creds, id);
    });
}

module.exports = { init };
