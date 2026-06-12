// OLE OS — Training-Load / ACWR
// Acute (7d) vs Chronic (4-Wochen-Schnitt) Wochenkilometer als Verletzungs-Frühwarner.
// Faustregel: ACWR > 1.5 = riskante Belastungsspitze, < 0.8 = Detraining.
// Zusätzlich Wochen-Rampe (diese 7d vs vorherige 7d) — > 10 % = Vorsicht.

function kmOf(a) {
    return (a?.distance || 0) / 1000;
}

function isRun(a) {
    return a?.type === "Run" || a?.sport_type === "Run";
}

// activities (mit start_date_local, distance, type) → Kennzahlen | null
export function computeLoad(activities) {
    if (!Array.isArray(activities) || !activities.length) return null;
    const runs = activities.filter(isRun);
    if (!runs.length) return null;

    const dayMs = 86400000;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const nowMs = now.getTime();

    const sumBetween = (fromDaysAgo, toDaysAgo) => {
        const from = nowMs - fromDaysAgo * dayMs;
        const to = nowMs - toDaysAgo * dayMs;
        return runs.reduce((s, a) => {
            const t = new Date(a.start_date_local).getTime();
            return t >= from && t <= to ? s + kmOf(a) : s;
        }, 0);
    };

    const acute = sumBetween(7, 0);            // letzte 7 Tage
    const chronicTotal = sumBetween(28, 0);    // letzte 28 Tage
    const chronicWeekly = chronicTotal / 4;    // Schnitt/Woche
    const prev = sumBetween(14, 7);            // 8–14 Tage zurück
    const ratio = chronicWeekly > 0 ? acute / chronicWeekly : null;
    const rampPct = prev > 0 ? ((acute - prev) / prev) * 100 : null;

    let zone = "ok";
    if (ratio != null) {
        if (ratio > 1.5) zone = "high";
        else if (ratio > 1.3) zone = "caution";
        else if (ratio < 0.8 && chronicWeekly > 5) zone = "low";
    }

    return {
        acuteKm: Math.round(acute * 10) / 10,
        chronicWeeklyKm: Math.round(chronicWeekly * 10) / 10,
        ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
        rampPct: rampPct != null ? Math.round(rampPct) : null,
        zone,
    };
}

export function loadAdvice(zone) {
    switch (zone) {
        case "high":    return "Belastungsspitze — Verletzungsrisiko. Diese Woche nicht weiter steigern.";
        case "caution": return "Belastung zieht an — bewusst steigern, Erholung beachten.";
        case "low":     return "Volumen unter Schnitt — Basis bröckelt, dranbleiben.";
        default:        return "Belastung im grünen Bereich.";
    }
}
