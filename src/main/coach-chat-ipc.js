// OLE OS — Coach Chat IPC Bridge
// Handlers: coach:send, coach:clear, coach:get-history
// Broadcasts: coach:history-updated, coach:tool-event, todo:updated (nach Mutating-Tools)

const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { chat } = require('./coach-chat.js');
const todoStore = require('./todo-store.js');
const calendarStore = require('./calendar-store.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function historyPath() {
    return path.join(app.getPath('userData'), 'coach-chat.json');
}

function loadHistory() {
    try {
        const p = historyPath();
        if (!fs.existsSync(p)) return [];
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return Array.isArray(data.messages) ? data.messages : [];
    } catch (e) {
        console.warn('[coach-chat] load history failed:', e?.message);
        return [];
    }
}

function saveHistory(messages) {
    try {
        fs.writeFileSync(historyPath(), JSON.stringify({ messages }, null, 2));
    } catch (e) {
        console.warn('[coach-chat] save history failed:', e?.message);
    }
}

function clearHistory() {
    try { fs.unlinkSync(historyPath()); } catch { /* nicht vorhanden ist ok */ }
}

function init(getWindow, { getHealthSummary } = {}) {
    ipcMain.handle('coach:get-history', () => loadHistory());

    ipcMain.handle('coach:clear', () => {
        clearHistory();
        broadcast(getWindow(), 'coach:history-updated', []);
        return { ok: true };
    });

    ipcMain.handle('coach:send', async (_e, { apiKey, userMessage } = {}) => {
        const history = loadHistory();
        const ctx = {
            getHealthSummary: getHealthSummary || (() => null),
            broadcastTodos: () => broadcast(getWindow(), 'todo:updated', todoStore.loadAll()),
            broadcastCalendar: () => broadcast(getWindow(), 'calendar:updated', {
                subscriptions: calendarStore.loadSubscriptions(),
                events: calendarStore.loadAllEvents(),
            }),
            onToolEvent: (ev) => broadcast(getWindow(), 'coach:tool-event', ev),
        };
        try {
            const { messages, text } = await chat({ apiKey, history, userMessage, ctx });
            saveHistory(messages);
            broadcast(getWindow(), 'coach:history-updated', messages);
            return { ok: true, text, messages };
        } catch (e) {
            const msg = String(e?.message || e);
            console.error('[coach-chat] error:', msg);
            return { ok: false, error: msg };
        }
    });
}

module.exports = { init };
