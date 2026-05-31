// OLE OS — ToDo Store
// Persistiert items + migrateFlag in userData/todos.json.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function todosPath() {
    return path.join(app.getPath('userData'), 'todos.json');
}

function emptyState() {
    return { items: [], migratedFromLocalStorage: false };
}

function loadAll() {
    try {
        const p = todosPath();
        if (!fs.existsSync(p)) return emptyState();
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
            items: Array.isArray(data.items) ? data.items : [],
            migratedFromLocalStorage: !!data.migratedFromLocalStorage,
        };
    } catch (e) {
        console.warn('[todo-store] load failed, resetting:', e?.message);
        return emptyState();
    }
}

function saveAll(data) {
    fs.writeFileSync(todosPath(), JSON.stringify(data, null, 2));
}

function nextOrder(items) {
    if (!items.length) return 0;
    return Math.max(...items.map((i) => i.order ?? 0)) + 1;
}

const CATEGORIES = ['uni', 'sport', 'life', 'errands'];

function normalizeCategory(c) {
    const k = String(c || '').toLowerCase();
    return CATEGORIES.includes(k) ? k : 'life';
}

function normalizePriority(p) {
    const n = parseInt(p, 10);
    return [1, 2, 3].includes(n) ? n : 2;
}

function add(partial = {}) {
    const all = loadAll();
    const item = {
        id: crypto.randomUUID(),
        title: String(partial.title || '').trim() || 'Neue Aufgabe',
        category: normalizeCategory(partial.category),
        priority: normalizePriority(partial.priority),
        dueDate: partial.dueDate || null,
        order: nextOrder(all.items),
        createdAt: new Date().toISOString(),
        completedAt: null,
    };
    all.items.push(item);
    saveAll(all);
    return item;
}

function update(id, patch = {}) {
    const all = loadAll();
    const idx = all.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const cur = all.items[idx];
    const next = { ...cur };
    if (patch.title !== undefined) next.title = String(patch.title).trim() || cur.title;
    if (patch.category !== undefined) next.category = normalizeCategory(patch.category);
    if (patch.priority !== undefined) next.priority = normalizePriority(patch.priority);
    if (patch.dueDate !== undefined) next.dueDate = patch.dueDate || null;
    all.items[idx] = next;
    saveAll(all);
    return next;
}

function remove(id) {
    const all = loadAll();
    all.items = all.items.filter((i) => i.id !== id);
    saveAll(all);
    return { ok: true };
}

function toggleDone(id) {
    const all = loadAll();
    const idx = all.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const cur = all.items[idx];
    all.items[idx] = {
        ...cur,
        completedAt: cur.completedAt ? null : new Date().toISOString(),
    };
    saveAll(all);
    return all.items[idx];
}

function reorder(orderedIds) {
    if (!Array.isArray(orderedIds) || !orderedIds.length) return loadAll();
    const all = loadAll();
    // Vergibt neue order-Werte, basierend auf max-Wert + Index
    const baseMax = nextOrder(all.items);
    orderedIds.forEach((id, i) => {
        const idx = all.items.findIndex((it) => it.id === id);
        if (idx >= 0) all.items[idx] = { ...all.items[idx], order: baseMax + i };
    });
    saveAll(all);
    return all;
}

function migrate(legacyItems) {
    const all = loadAll();
    if (all.migratedFromLocalStorage) return all;
    const arr = Array.isArray(legacyItems) ? legacyItems : [];
    let base = nextOrder(all.items);
    for (const raw of arr) {
        const title = String(raw.text || raw.title || '').trim();
        if (!title) continue;
        all.items.push({
            id: crypto.randomUUID(),
            title,
            category: normalizeCategory(raw.cat || raw.category),
            priority: 2,
            dueDate: null,
            order: base++,
            createdAt: raw.createdAt || new Date().toISOString(),
            completedAt: raw.done ? new Date().toISOString() : null,
        });
    }
    all.migratedFromLocalStorage = true;
    saveAll(all);
    return all;
}

module.exports = { loadAll, add, update, remove, toggleDone, reorder, migrate };
