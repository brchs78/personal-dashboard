// OLE OS — Vault Export IPC Bridge
// Handlers: vault:get-settings, vault:set-path, vault:export-day, vault:export-today
// Broadcasts 'vault:updated' nach Mutation.

const { ipcMain, dialog } = require('electron');
const vault = require('./vault-export.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow, deps = {}) {
    // deps: { getHabits, getStreaks, getPlan, getActivities }

    ipcMain.handle('vault:get-settings', () => vault.loadSettings());

    ipcMain.handle('vault:set-path', async () => {
        const win = getWindow();
        const result = await dialog.showOpenDialog(win, {
            title: 'Obsidian Vault wählen',
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || !result.filePaths?.[0]) {
            return vault.loadSettings();
        }
        const next = vault.saveSettings({ path: result.filePaths[0] });
        broadcast(win, 'vault:updated', next);
        return next;
    });

    ipcMain.handle('vault:set-auto-export', (_e, enabled) => {
        const next = vault.saveSettings({ autoExport: !!enabled });
        broadcast(getWindow(), 'vault:updated', next);
        return next;
    });

    ipcMain.handle('vault:set-export-coach', (_e, enabled) => {
        const next = vault.saveSettings({ exportCoach: !!enabled });
        broadcast(getWindow(), 'vault:updated', next);
        return next;
    });

    ipcMain.handle('vault:export-range', async (_e, { from, to } = {}) => {
        try {
            const res = vault.exportRange(from, to, deps);
            broadcast(getWindow(), 'vault:updated', vault.loadSettings());
            return res;
        } catch (e) {
            return { ok: false, error: e?.message || 'export_failed' };
        }
    });

    ipcMain.handle('vault:export-day', async (_e, date) => {
        try {
            const res = vault.exportDay(date, deps);
            broadcast(getWindow(), 'vault:updated', vault.loadSettings());
            return res;
        } catch (e) {
            return { ok: false, error: e?.message || 'export_failed' };
        }
    });

    ipcMain.handle('vault:export-today', async () => {
        try {
            const res = vault.exportDay(null, deps);
            broadcast(getWindow(), 'vault:updated', vault.loadSettings());
            return res;
        } catch (e) {
            return { ok: false, error: e?.message || 'export_failed' };
        }
    });
}

module.exports = { init, exportDay: vault.exportDay };
