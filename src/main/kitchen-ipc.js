// OLE OS — Küchen IPC Bridge
// Handlers für Inventar, auswärtige Mahlzeiten, Rezepte, Makro-Profile,
// Kosten-Report sowie KI-Calls (Bon-Import + Rezeptgenerierung).
// Broadcastet 'kitchen:updated' nach jeder Mutation.

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const store = require('./kitchen-store.js');
const ai = require('./kitchen-ai.js');

function broadcast(win, channel, payload) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function init(getWindow) {
    const emit = (returnValue) => {
        broadcast(getWindow(), 'kitchen:updated', store.loadAll());
        return returnValue;
    };

    ipcMain.handle('kitchen:get-all', () => store.loadAll());
    ipcMain.handle('kitchen:cost-report', () => store.weeklyCostReport());

    // ── Bon-Import ────────────────────────────────────────────────────
    // Öffnet Datei-Dialog, liest PDF, parst via Claude. Speichert NICHT —
    // gibt Vorschau-Items zurück, die der Renderer bestätigen muss.
    ipcMain.handle('kitchen:import-receipt', async (_e, { apiKey } = {}) => {
        const win = getWindow();
        const res = await dialog.showOpenDialog(win, {
            title: 'Kassenbon (PDF) wählen',
            properties: ['openFile'],
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (res.canceled || !res.filePaths?.length) return { canceled: true };
        const filePath = res.filePaths[0];
        const base64Pdf = fs.readFileSync(filePath).toString('base64');
        const items = await ai.parseReceipt({ apiKey, base64Pdf });
        return { canceled: false, fileName: filePath.split('/').pop(), items };
    });

    // Bestätigte Items ins Inventar übernehmen.
    ipcMain.handle('kitchen:confirm-import', (_e, items) =>
        emit(store.bulkAddInventory(items))
    );

    // ── Inventar ──────────────────────────────────────────────────────
    ipcMain.handle('kitchen:inv-add', (_e, partial) => emit(store.addInventoryItem(partial)));
    ipcMain.handle('kitchen:inv-update', (_e, { id, patch } = {}) => emit(store.updateInventoryItem(id, patch)));
    ipcMain.handle('kitchen:inv-remove', (_e, id) => emit(store.removeInventoryItem(id)));
    ipcMain.handle('kitchen:inv-consume', (_e, { id, amount } = {}) => emit(store.consumeInventoryItem(id, amount)));

    // ── Auswärtige Mahlzeiten ─────────────────────────────────────────
    // Makros aus freier Beschreibung schätzen (speichert NICHT).
    ipcMain.handle('kitchen:meal-estimate', async (_e, { apiKey, description, mealType } = {}) =>
        ai.estimateMeal({ apiKey, description, mealType })
    );
    ipcMain.handle('kitchen:meal-add', (_e, partial) => emit(store.addMeal(partial)));
    ipcMain.handle('kitchen:meal-update', (_e, { id, patch } = {}) => emit(store.updateMeal(id, patch)));
    ipcMain.handle('kitchen:meal-remove', (_e, id) => emit(store.removeMeal(id)));

    // ── Rezepte ───────────────────────────────────────────────────────
    ipcMain.handle('kitchen:recipe-generate', async (_e, opts = {}) => {
        const { apiKey, macroTarget, trainingLabel, servings, mealType } = opts;
        const inventory = store.loadAll().inventory;
        return ai.generateRecipe({ apiKey, inventory, macroTarget, trainingLabel, servings, mealType });
    });
    ipcMain.handle('kitchen:recipe-save', (_e, recipe) => emit(store.saveRecipe(recipe)));
    ipcMain.handle('kitchen:recipe-update', (_e, { id, patch } = {}) => emit(store.updateRecipe(id, patch)));
    ipcMain.handle('kitchen:recipe-remove', (_e, id) => emit(store.removeRecipe(id)));
    // Meal-Prep: bestätigte Inventar-Reduktionen anwenden.
    ipcMain.handle('kitchen:apply-consumption', (_e, reductions) => emit(store.applyConsumption(reductions)));

    // ── Tagesplan ─────────────────────────────────────────────────────
    ipcMain.handle('kitchen:dayplan-generate', async (_e, opts = {}) => {
        const { apiKey, macroTarget, trainingLabel, alreadyEaten } = opts;
        const inventory = store.loadAll().inventory;
        return ai.generateDayPlan({ apiKey, inventory, macroTarget, trainingLabel, alreadyEaten });
    });

    // ── Makro-Profile & Overrides ─────────────────────────────────────
    ipcMain.handle('kitchen:macro-profile-update', (_e, { category, patch } = {}) =>
        emit(store.updateMacroProfile(category, patch))
    );
    ipcMain.handle('kitchen:macro-override', (_e, { date, macros } = {}) =>
        emit(store.setMacroOverride(date, macros))
    );
}

module.exports = { init };
