// OLE OS — Health IPC Bridge
// Initialisiert beim App-Start: lädt Cache oder triggert Reparse.
// IPC-Handler für Renderer-Zugriff auf Summary + Trends.

const { ipcMain, app } = require('electron');
const { parseHealthExport } = require('./health-parser.js');
const store = require('./health-store.js');

let state = {
    status: 'idle', // 'idle' | 'parsing' | 'ready' | 'error' | 'no-source'
    aggregates: null,
    error: null,
    progress: 0,
};

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
    }
}

async function loadOrParse(win) {
    const userDataDir = app.getPath('userData');

    if (!store.sourceExists()) {
        state.status = 'no-source';
        broadcast(win, 'health:ready', { status: state.status });
        return;
    }

    if (!store.needsReparse(userDataDir)) {
        state.aggregates = store.load(userDataDir);
        state.status = 'ready';
        broadcast(win, 'health:ready', { status: state.status, meta: state.aggregates?.meta });
        return;
    }

    state.status = 'parsing';
    state.progress = 0;
    broadcast(win, 'health:progress', { percent: 0 });

    try {
        const aggregates = await parseHealthExport(store.SOURCE_PATH, {
            onProgress: (percent) => {
                state.progress = percent;
                broadcast(win, 'health:progress', { percent });
            },
        });
        store.save(userDataDir, aggregates);
        state.aggregates = aggregates;
        state.status = 'ready';
        state.progress = 100;
        broadcast(win, 'health:ready', { status: state.status, meta: aggregates.meta });
    } catch (err) {
        state.status = 'error';
        state.error = String(err);
        broadcast(win, 'health:ready', { status: 'error', error: state.error });
    }
}

// Trends: Array von { date, value } für eine Metrik über die letzten N Tage
function getTrend(metric, days) {
    if (!state.aggregates) return [];
    const all = state.aggregates.days;
    const keys = Object.keys(all).sort();
    const out = [];

    const pickValue = (d) => {
        switch (metric) {
            case 'rhr':         return d.rhr?.avg;
            case 'hrv':         return d.hrv?.avg;
            case 'hrRecovery':  return d.hrRecovery1min?.avg;
            case 'walkingHr':   return d.walkingHrAvg?.avg;
            case 'sleepTotal':  return d.sleep?.totalMin;
            case 'sleepDeep':   return d.sleep?.stages?.deep;
            case 'sleepRem':    return d.sleep?.stages?.rem;
            default:            return undefined;
        }
    };

    for (const k of keys) {
        const v = pickValue(all[k]);
        if (v != null && Number.isFinite(v)) out.push({ date: k, value: v });
    }
    return days ? out.slice(-days) : out;
}

function init(getWindow) {
    ipcMain.handle('health:get-summary', () => {
        if (!state.aggregates) return { status: state.status, summary: null };
        return {
            status: state.status,
            summary: {
                latest: state.aggregates.latest,
                meta: state.aggregates.meta,
            },
        };
    });

    ipcMain.handle('health:get-trends', (_e, metric, days) => getTrend(metric, days));

    ipcMain.handle('health:refresh', async () => {
        const userDataDir = app.getPath('userData');
        store.clear(userDataDir);
        await loadOrParse(getWindow());
        return { status: state.status };
    });

    // App-Start: load-or-parse async, blockiert nicht
    loadOrParse(getWindow()).catch((e) => {
        console.error('[health] init failed:', e);
    });
}

function getCurrentSummary() {
    if (!state.aggregates) return null;
    return { latest: state.aggregates.latest, meta: state.aggregates.meta };
}

module.exports = { init, getCurrentSummary, getTrend };
