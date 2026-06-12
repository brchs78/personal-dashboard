// OLE OS — Küchen-Store
// Persistiert Inventar, auswärtige Mahlzeiten, Rezepte, Makro-Profile/-Overrides
// in userData/kitchen.json. Synchrones loadAll/saveAll wie todo-store.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { todayISO, toLocalISO } = require('./utils/date.js');

function kitchenPath() {
    return path.join(app.getPath('userData'), 'kitchen.json');
}

// Default-Makroziele für 72kg/193cm Ausdauerathlet, getrennt nach Trainings-Last.
// kcal grob = p*4 + c*4 + f*9. Editierbar pro Kategorie.
function defaultProfiles() {
    return {
        rest:    { label: 'Ruhetag',        kcal: 2400, protein: 144, carbs: 294, fat: 72 },
        easy:    { label: 'Easy / Zone 2',  kcal: 2800, protein: 144, carbs: 398, fat: 70 },
        quality: { label: 'Quality / Intervall', kcal: 3000, protein: 150, carbs: 442, fat: 70 },
        long:    { label: 'Long Run',       kcal: 3300, protein: 150, carbs: 506, fat: 75 },
    };
}

// Mapping Plan-Tagestyp → Makro-Kategorie.
const TYPE_TO_CATEGORY = {
    'Rest': 'rest',
    'Yoga+Easy': 'rest',
    'Easy': 'easy',
    'Recovery': 'easy',
    'Cross': 'easy',
    'Gym+Easy': 'easy',
    'Tempo': 'quality',
    'Threshold': 'quality',
    'Intervals': 'quality',
    'Long': 'long',
};

function categoryForType(type) {
    return TYPE_TO_CATEGORY[type] || 'easy';
}

function emptyState() {
    return {
        inventory: [],
        externalMeals: [],
        recipes: [],
        macroProfiles: defaultProfiles(),
        macroOverrides: {}, // { 'YYYY-MM-DD': { kcal, protein, carbs, fat } }
    };
}

function loadAll() {
    try {
        const p = kitchenPath();
        if (!fs.existsSync(p)) return emptyState();
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const base = emptyState();
        return {
            inventory: Array.isArray(data.inventory) ? data.inventory : [],
            externalMeals: Array.isArray(data.externalMeals) ? data.externalMeals : [],
            recipes: Array.isArray(data.recipes) ? data.recipes : [],
            macroProfiles: { ...base.macroProfiles, ...(data.macroProfiles || {}) },
            macroOverrides: data.macroOverrides && typeof data.macroOverrides === 'object' ? data.macroOverrides : {},
        };
    } catch (e) {
        console.warn('[kitchen-store] load failed, resetting:', e?.message);
        return emptyState();
    }
}

function saveAll(data) {
    try {
        fs.writeFileSync(kitchenPath(), JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn('[kitchen-store] save failed:', e?.message);
        throw new Error(`kitchen_save_failed: ${e?.message || e}`);
    }
}

// Im Küchen-Kontext sind alle Zahlen (Mengen, Preise, Makros, Kosten) >= 0.
// Negative Eingaben werden auf 0 geklemmt statt korrupte Daten zu speichern.
function num(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return n < 0 ? 0 : n;
}

// ── Inventar ─────────────────────────────────────────────────────────
function normalizeItem(raw = {}) {
    return {
        id: raw.id || crypto.randomUUID(),
        name: String(raw.name || '').trim() || 'Unbenannt',
        qty: num(raw.qty, 1),
        unit: String(raw.unit || 'Stk').trim() || 'Stk',
        price: raw.price === null || raw.price === undefined ? null : num(raw.price, 0),
        purchaseDate: raw.purchaseDate || todayISO(),
        expiryDate: raw.expiryDate || null,
        createdAt: raw.createdAt || new Date().toISOString(),
    };
}

function addInventoryItem(partial = {}) {
    const all = loadAll();
    const item = normalizeItem(partial);
    all.inventory.push(item);
    saveAll(all);
    return item;
}

// Mehrere Items auf einmal (aus bestätigtem Bon-Import).
function bulkAddInventory(items = []) {
    const all = loadAll();
    const added = (Array.isArray(items) ? items : []).map(normalizeItem);
    all.inventory.push(...added);
    saveAll(all);
    return added;
}

function updateInventoryItem(id, patch = {}) {
    const all = loadAll();
    const idx = all.inventory.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const cur = all.inventory[idx];
    const next = { ...cur };
    if (patch.name !== undefined) next.name = String(patch.name).trim() || cur.name;
    if (patch.qty !== undefined) next.qty = num(patch.qty, cur.qty);
    if (patch.unit !== undefined) next.unit = String(patch.unit).trim() || cur.unit;
    if (patch.price !== undefined) next.price = patch.price === null ? null : num(patch.price, cur.price);
    if (patch.purchaseDate !== undefined) next.purchaseDate = patch.purchaseDate || cur.purchaseDate;
    if (patch.expiryDate !== undefined) next.expiryDate = patch.expiryDate || null;
    all.inventory[idx] = next;
    saveAll(all);
    return next;
}

function removeInventoryItem(id) {
    const all = loadAll();
    all.inventory = all.inventory.filter((i) => i.id !== id);
    saveAll(all);
    return { ok: true };
}

// "Habe gegessen" — Menge um amount reduzieren, bei <= 0 entfernen.
function consumeInventoryItem(id, amount) {
    const all = loadAll();
    const idx = all.inventory.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const cur = all.inventory[idx];
    const nextQty = Math.round((cur.qty - num(amount, cur.qty)) * 1000) / 1000;
    if (nextQty <= 0) {
        all.inventory.splice(idx, 1);
        saveAll(all);
        return { id, removed: true };
    }
    all.inventory[idx] = { ...cur, qty: nextQty };
    saveAll(all);
    return all.inventory[idx];
}

// ── Auswärtige Mahlzeiten ────────────────────────────────────────────
function normalizeMeal(raw = {}) {
    return {
        id: raw.id || crypto.randomUUID(),
        name: String(raw.name || '').trim() || 'Mahlzeit',
        calories: num(raw.calories, 0),
        protein: num(raw.protein, 0),
        carbs: num(raw.carbs, 0),
        fat: num(raw.fat, 0),
        cost: num(raw.cost, 0),
        date: raw.date || todayISO(),
        createdAt: raw.createdAt || new Date().toISOString(),
    };
}

function addMeal(partial = {}) {
    const all = loadAll();
    const meal = normalizeMeal(partial);
    all.externalMeals.push(meal);
    saveAll(all);
    return meal;
}

function updateMeal(id, patch = {}) {
    const all = loadAll();
    const idx = all.externalMeals.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const cur = all.externalMeals[idx];
    const next = { ...cur };
    if (patch.name !== undefined) next.name = String(patch.name).trim() || cur.name;
    if (patch.calories !== undefined) next.calories = num(patch.calories, cur.calories);
    if (patch.protein !== undefined) next.protein = num(patch.protein, cur.protein);
    if (patch.carbs !== undefined) next.carbs = num(patch.carbs, cur.carbs);
    if (patch.fat !== undefined) next.fat = num(patch.fat, cur.fat);
    if (patch.cost !== undefined) next.cost = num(patch.cost, cur.cost);
    if (patch.date !== undefined) next.date = patch.date || cur.date;
    all.externalMeals[idx] = next;
    saveAll(all);
    return next;
}

function removeMeal(id) {
    const all = loadAll();
    all.externalMeals = all.externalMeals.filter((m) => m.id !== id);
    saveAll(all);
    return { ok: true };
}

// ── Rezepte ──────────────────────────────────────────────────────────
function saveRecipe(recipe = {}) {
    const all = loadAll();
    const item = {
        id: recipe.id || crypto.randomUUID(),
        title: String(recipe.title || 'Rezept').trim(),
        servings: num(recipe.servings, 1),
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        missing: Array.isArray(recipe.missing) ? recipe.missing : [],
        steps: Array.isArray(recipe.steps) ? recipe.steps : [],
        macros: recipe.macros || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        mealPrep: recipe.mealPrep || null, // { days, scale }
        createdAt: recipe.createdAt || new Date().toISOString(),
    };
    const idx = all.recipes.findIndex((r) => r.id === item.id);
    if (idx >= 0) all.recipes[idx] = item;
    else all.recipes.unshift(item);
    saveAll(all);
    return item;
}

function updateRecipe(id, patch = {}) {
    const all = loadAll();
    const idx = all.recipes.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    all.recipes[idx] = { ...all.recipes[idx], ...patch, id };
    saveAll(all);
    return all.recipes[idx];
}

function removeRecipe(id) {
    const all = loadAll();
    all.recipes = all.recipes.filter((r) => r.id !== id);
    saveAll(all);
    return { ok: true };
}

// Meal-Prep: bestätigte Inventar-Reduktionen anwenden.
// reductions = [{ id, amount }]
function applyConsumption(reductions = []) {
    const all = loadAll();
    for (const r of Array.isArray(reductions) ? reductions : []) {
        const idx = all.inventory.findIndex((i) => i.id === r.id);
        if (idx < 0) continue;
        const cur = all.inventory[idx];
        const nextQty = Math.round((cur.qty - num(r.amount, 0)) * 1000) / 1000;
        if (nextQty <= 0) all.inventory.splice(idx, 1);
        else all.inventory[idx] = { ...cur, qty: nextQty };
    }
    saveAll(all);
    return all.inventory;
}

// ── Makro-Profile & Overrides ────────────────────────────────────────
function updateMacroProfile(category, patch = {}) {
    const all = loadAll();
    if (!all.macroProfiles[category]) return null;
    const cur = all.macroProfiles[category];
    all.macroProfiles[category] = {
        ...cur,
        kcal: patch.kcal !== undefined ? num(patch.kcal, cur.kcal) : cur.kcal,
        protein: patch.protein !== undefined ? num(patch.protein, cur.protein) : cur.protein,
        carbs: patch.carbs !== undefined ? num(patch.carbs, cur.carbs) : cur.carbs,
        fat: patch.fat !== undefined ? num(patch.fat, cur.fat) : cur.fat,
    };
    saveAll(all);
    return all.macroProfiles[category];
}

function setMacroOverride(date, macros) {
    const all = loadAll();
    if (!date) return all.macroOverrides;
    if (macros === null) {
        delete all.macroOverrides[date];
    } else {
        all.macroOverrides[date] = {
            kcal: num(macros.kcal, 0),
            protein: num(macros.protein, 0),
            carbs: num(macros.carbs, 0),
            fat: num(macros.fat, 0),
        };
    }
    saveAll(all);
    return all.macroOverrides;
}

// ── Wochen-Kostenreport ──────────────────────────────────────────────
// Liefert pro Kalenderwoche { weekStart, groceries, dining, total }.
function mondayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return null;
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return toLocalISO(d);
}

function weeklyCostReport() {
    const all = loadAll();
    const weeks = {};
    const ensure = (wk) => (weeks[wk] = weeks[wk] || { weekStart: wk, groceries: 0, dining: 0, total: 0 });
    for (const item of all.inventory) {
        if (item.price === null || item.price === undefined) continue;
        const wk = mondayOf(item.purchaseDate);
        if (!wk) continue;
        const w = ensure(wk);
        w.groceries += num(item.price, 0);
        w.total += num(item.price, 0);
    }
    for (const meal of all.externalMeals) {
        const wk = mondayOf(meal.date);
        if (!wk) continue;
        const w = ensure(wk);
        w.dining += num(meal.cost, 0);
        w.total += num(meal.cost, 0);
    }
    return Object.values(weeks)
        .map((w) => ({
            weekStart: w.weekStart,
            groceries: Math.round(w.groceries * 100) / 100,
            dining: Math.round(w.dining * 100) / 100,
            total: Math.round(w.total * 100) / 100,
        }))
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

module.exports = {
    loadAll,
    categoryForType,
    addInventoryItem,
    bulkAddInventory,
    updateInventoryItem,
    removeInventoryItem,
    consumeInventoryItem,
    addMeal,
    updateMeal,
    removeMeal,
    saveRecipe,
    updateRecipe,
    removeRecipe,
    applyConsumption,
    updateMacroProfile,
    setMacroOverride,
    weeklyCostReport,
};
