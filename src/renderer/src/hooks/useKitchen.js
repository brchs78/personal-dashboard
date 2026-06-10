// OLE OS — Küchen Renderer-Hook
// Spiegelt kitchen.json (Inventar, Mahlzeiten, Rezepte, Makro-Profile/Overrides)
// und reicht KI-Calls (Bon-Import, Rezeptgenerierung) durch.

import { useEffect, useState, useCallback } from 'react';

function api() {
    return typeof window !== 'undefined' ? window.oleAPI?.kitchen : null;
}

function getKey() {
    try { return localStorage.getItem('ole:api-key') || ''; } catch { return ''; }
}

const EMPTY = { inventory: [], externalMeals: [], recipes: [], macroProfiles: {}, macroOverrides: {} };

export function useKitchen() {
    const [data, setData] = useState(EMPTY);
    const [costs, setCosts] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const refreshCosts = useCallback(async () => {
        const a = api(); if (!a) return;
        try { setCosts(await a.costReport() || []); } catch (e) { /* noop */ }
    }, []);

    const refresh = useCallback(async () => {
        const a = api(); if (!a) return;
        try {
            setData(await a.getAll() || EMPTY);
            await refreshCosts();
        } catch (e) { setError(String(e)); }
    }, [refreshCosts]);

    useEffect(() => {
        const a = api(); if (!a) return;
        refresh();
        const unsub = a.onUpdated((d) => { setData(d || EMPTY); refreshCosts(); });
        return () => { unsub?.(); };
    }, [refresh, refreshCosts]);

    // ── Inventar ──────────────────────────────────────────────────────
    const invAdd = useCallback((partial) => api()?.invAdd(partial), []);
    const invUpdate = useCallback((id, patch) => api()?.invUpdate(id, patch), []);
    const invRemove = useCallback((id) => api()?.invRemove(id), []);
    const invConsume = useCallback((id, amount) => api()?.invConsume(id, amount), []);

    // ── Mahlzeiten ────────────────────────────────────────────────────
    const mealAdd = useCallback((partial) => api()?.mealAdd(partial), []);
    const mealUpdate = useCallback((id, patch) => api()?.mealUpdate(id, patch), []);
    const mealRemove = useCallback((id) => api()?.mealRemove(id), []);
    // Makros aus freier Beschreibung schätzen lassen (kein Speichern).
    const estimateMeal = useCallback(async (description, mealType) => {
        const a = api(); if (!a) return null;
        const apiKey = getKey();
        if (!apiKey) { setError('Kein API-Key in Settings hinterlegt'); return null; }
        setBusy(true); setError(null);
        try {
            return await a.mealEstimate({ apiKey, description, mealType });
        } catch (e) {
            setError(String(e?.message || e));
            return null;
        } finally {
            setBusy(false);
        }
    }, []);

    // ── Bon-Import ────────────────────────────────────────────────────
    const importReceipt = useCallback(async () => {
        const a = api(); if (!a) return null;
        const apiKey = getKey();
        if (!apiKey) { setError('Kein API-Key in Settings hinterlegt'); return null; }
        setBusy(true); setError(null);
        try {
            return await a.importReceipt(apiKey);
        } catch (e) {
            setError(String(e?.message || e));
            return null;
        } finally {
            setBusy(false);
        }
    }, []);

    const confirmImport = useCallback((items) => api()?.confirmImport(items), []);

    // ── Rezepte ───────────────────────────────────────────────────────
    const generateRecipe = useCallback(async (opts = {}) => {
        const a = api(); if (!a) return null;
        const apiKey = getKey();
        if (!apiKey) { setError('Kein API-Key in Settings hinterlegt'); return null; }
        setBusy(true); setError(null);
        try {
            return await a.recipeGenerate({ apiKey, ...opts });
        } catch (e) {
            setError(String(e?.message || e));
            return null;
        } finally {
            setBusy(false);
        }
    }, []);

    const saveRecipe = useCallback((recipe) => api()?.recipeSave(recipe), []);
    const updateRecipe = useCallback((id, patch) => api()?.recipeUpdate(id, patch), []);
    const removeRecipe = useCallback((id) => api()?.recipeRemove(id), []);
    const applyConsumption = useCallback((reductions) => api()?.applyConsumption(reductions), []);

    // ── Makros ────────────────────────────────────────────────────────
    const updateMacroProfile = useCallback((category, patch) => api()?.macroProfileUpdate(category, patch), []);
    const setMacroOverride = useCallback((date, macros) => api()?.macroOverride(date, macros), []);

    // ── Tagesplan ─────────────────────────────────────────────────────
    const generateDayPlan = useCallback(async (opts = {}) => {
        const a = api(); if (!a) return null;
        const apiKey = getKey();
        if (!apiKey) { setError('Kein API-Key in Settings hinterlegt'); return null; }
        setBusy(true); setError(null);
        try {
            return await a.dayplanGenerate({ apiKey, ...opts });
        } catch (e) {
            setError(String(e?.message || e));
            return null;
        } finally {
            setBusy(false);
        }
    }, []);

    return {
        data, costs, busy, error,
        invAdd, invUpdate, invRemove, invConsume,
        mealAdd, mealUpdate, mealRemove, estimateMeal,
        importReceipt, confirmImport,
        generateRecipe, saveRecipe, updateRecipe, removeRecipe, applyConsumption,
        updateMacroProfile, setMacroOverride, generateDayPlan,
    };
}

// Plan-Tagestyp → Makro-Kategorie (gespiegelt aus kitchen-store.js).
const TYPE_TO_CATEGORY = {
    'Rest': 'rest', 'Yoga+Easy': 'rest',
    'Easy': 'easy', 'Recovery': 'easy', 'Cross': 'easy', 'Gym+Easy': 'easy',
    'Tempo': 'quality', 'Threshold': 'quality', 'Intervals': 'quality',
    'Long': 'long',
};

export function categoryForType(type) {
    return TYPE_TO_CATEGORY[type] || 'easy';
}
