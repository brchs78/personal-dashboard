// OLE OS — Readiness-Score
// Bewertet die Tagesform aus HRV, Ruhepuls und Schlaf — relativ zur PERSÖNLICHEN
// 30-Tage-Baseline (z-Score), nicht gegen absolute Normwerte. So ist der Score
// individuell aussagekräftig. Fallback: Recovery-% wenn keine Trends da sind.

import { daysAgo } from "./date.js";

function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function std(arr, m) {
    if (arr.length < 2) return null;
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(v);
}

// z-Score des neuesten Werts gegen die Baseline (alle vorherigen), geclamped [-2,2].
function zScore(points) {
    if (!Array.isArray(points)) return null;
    const vals = points.map((p) => p.value).filter(Number.isFinite);
    if (vals.length < 4) return null;
    const today = vals[vals.length - 1];
    const base = vals.slice(0, -1);
    const m = mean(base);
    const s = std(base, m);
    if (m == null || !s) return null;
    return Math.max(-2, Math.min(2, (today - m) / s));
}

// z in [-2,2] → 0..100 (höher = besser)
function zToScore(z) {
    return Math.round(((z + 2) / 4) * 100);
}

function levelOf(s) {
    if (s >= 66) return "green";
    if (s >= 40) return "amber";
    return "red";
}

// { latest, hrvTrend, rhrTrend, sleepTrend } → { score, level, factors, stale } | null
export function computeReadiness({ latest, hrvTrend, rhrTrend, sleepTrend } = {}) {
    const parts = [];
    const hrvZ = zScore(hrvTrend); // mehr HRV = besser
    if (hrvZ != null) parts.push({ key: "HRV", weight: 0.4, score: zToScore(hrvZ) });
    const rhrZ = zScore(rhrTrend); // höherer Ruhepuls = schlechter → invertieren
    if (rhrZ != null) parts.push({ key: "Ruhepuls", weight: 0.3, score: zToScore(-rhrZ) });
    const sleepZ = zScore(sleepTrend); // mehr Schlaf = besser
    if (sleepZ != null) parts.push({ key: "Schlaf", weight: 0.3, score: zToScore(sleepZ) });

    if (!parts.length) {
        if (latest?.recovery?.value != null) {
            const s = Math.round(latest.recovery.value);
            const stale = latest.recovery.date ? daysAgo(latest.recovery.date) > 2 : false;
            return { score: s, level: levelOf(s), factors: [{ key: "Recovery", score: s }], stale };
        }
        return null;
    }

    const wsum = parts.reduce((a, p) => a + p.weight, 0);
    const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum);
    const newest = latest?.hrv?.date || latest?.rhr?.date || latest?.sleep?.date;
    const stale = newest ? daysAgo(newest) > 2 : false;

    return { score, level: levelOf(score), factors: parts, stale };
}

export function readinessAdvice(level) {
    switch (level) {
        case "green": return "Bereit für Quality oder Long Run.";
        case "amber": return "Moderat — Easy oder reduzierte Intensität.";
        case "red":   return "Erholung priorisieren — Easy oder Ruhe.";
        default:      return "";
    }
}
