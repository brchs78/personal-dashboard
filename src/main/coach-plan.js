// OLE OS — KI-Trainingsplan-Generator
// Sammelt Health-Snapshot + Strava-History, baut Prompt, ruft Anthropic API.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

const MARATHON_DATE = '2026-10-11';
const TARGET_TIME = '3:10';
const TARGET_PACE = '4:30/km';

const WEEK_FRAME = `WOCHEN-STRUKTUR (flexibel — DU empfiehlst, was optimal ist):
- 7 Tage Mo-So. Sonntag bleibt Ruhe-/Yoga-Tag (kein Lauf).
- Hockey ist VARIABLE Cross-Belastung — die Saison läuft aus. STANDARD-ANNAHME: 2 Einheiten (Di/Do, je ~90 min).
  WENN voraussichtlich weniger/keine Hockey-Einheiten anstehen: diese Tage als Easy Run nutzen und so dem Lauf-Volumenziel näherkommen.
- Verteile die Ziel-km (siehe ZIEL DIESE WOCHE) auf die empfohlene Anzahl Laufeinheiten. Long Run = Hauptlauf (Sa bevorzugt).
- Mind. 1 echter Ruhetag (So). Quality-Einheiten NUR in der vorgegebenen Anzahl.
- Felder "weeklyKm" und "recommendedRunDays" füllen. In "coachNote" klar angeben: geplante Wochen-km, Anzahl Laufeinheiten und wie Hockey eingeplant ist (inkl. was zu tun ist, wenn Hockey wegfällt).`;

// Deterministischer Makro-Anker (Mittelweg): leitet aus Resttagen bis zum
// Marathon + aktueller Lauf-Basis das ZIEL DIESER Woche ab — Volumen-Rampe,
// Long-Run-Leiter, empfohlene Lauftage, Quality. Gibt der Wochengenerierung
// einen kohärenten Bogen, ohne einen starren 19-Wochen-Plan zu speichern.
// baseKm = Schnitt der letzten abgeschlossenen Wochen (Boden 15, gegen Stillstand).
function macroPlan(daysToMarathon, baseKm) {
    const base = Math.max(baseKm || 0, 15);
    let phase, runDays, quality, mp, ramp, ceiling, longShare, longCap, focus, diagnosis;

    if (daysToMarathon <= 21) {
        phase = 'Taper'; runDays = 3; quality = 1; mp = true;
        ramp = 0.65; ceiling = Math.round(base); longShare = 0.4; longCap = 18;
        focus = 'Volumen ggü. Vorwoche -30 bis -40%, kurze MP-Touches (4:30/km) halten, Beine frisch machen.';
        diagnosis = 'Taper: Frische vor Volumen. Schärfe halten, Umfang runter.';
    } else if (daysToMarathon <= 49) {
        phase = 'Peak'; runDays = 5; quality = 2; mp = true;
        ramp = 1.08; ceiling = 75; longShare = 0.42; longCap = 34;
        focus = 'Long Run mit großen Marathon-Pace-Blöcken (z.B. 2×6-8 km @ 4:30/km), 1-2 Quality. Volumen am oberen Ende.';
        diagnosis = 'Peak: marathon-spezifische Härte. Volumen halten/leicht steigern, MP-Spezifität maximieren.';
    } else if (daysToMarathon <= 98) {
        phase = 'Build'; runDays = 4; quality = 1; mp = daysToMarathon <= 84;
        ramp = 1.12; ceiling = 60; longShare = 0.4; longCap = 28;
        focus = '1 Quality/Woche (Threshold 4:00-4:10/km ODER MP-Block 4:30/km), Rest Easy/Z2. Volumen progressiv steigern, MP im Long Run einführen.';
        diagnosis = 'Build: Volumen aufbauen + 1× Qualität. Aerobe Schwelle und erste MP-Spezifität.';
    } else {
        phase = 'Base'; runDays = 4; quality = 0; mp = false;
        ramp = 1.10; ceiling = 38; longShare = 0.4; longCap = 20;
        focus = 'NUR Z2/Easy + Long Run (Strides erlaubt). Konsistenz über ALLE Lauftage. Volumen sanft aufbauen.';
        diagnosis = 'Base: aerobe Basis + Konsistenz wiederaufbauen. Volumen vor Tempo, Verletzungen vermeiden.';
    }

    const weeklyKmTarget = Math.min(Math.round(base * ramp), ceiling);
    const longRunKm = Math.min(Math.round(weeklyKmTarget * longShare), longCap);
    return { phase, runDays, quality, mp, weeklyKmTarget, longRunKm, focus, diagnosis };
}

const COACH_PRINCIPLES = `COACH-PRINZIPIEN:
- 80/20 Polarized: 80% Z2 Easy, 20% Quality.
- "Volume first, Speed later" — Mitochondrien vor Schnelligkeit.
- HRV-basiertes Adjust: HRV niedrig → Quality zu Easy downgraden.
- +10% Wochenregel: niemals mehr als 10% Steigerung Woche-zu-Woche.
- Easy-Pace strikt 5:15-5:40/km (Z2, 130-150 bpm). Wenn schneller → BREMSEN.
- Marathon-Pace = 4:30/km (Sub-3:10). Threshold = 4:00-4:10/km. Intervalle = 3:45-3:55/km.`;

const HEALTH_CONSTRAINTS = `GESUNDHEIT: Keine akuten Einschränkungen — volle Belastbarkeit.
- Steuerung rein über Recovery-Status (HRV/Schlaf/RHR) unten: niedrige HRV oder schlechter Schlaf → Quality zu Easy downgraden.
- Bei Krankheits-/Erschöpfungssymptomen sofort Intensität senken.`;

// Alter eines ISO-Datums in Tagen (lokal). null wenn kein Datum.
function daysAgo(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((t - d) / 86400000);
}

function ageTag(dateStr) {
    const a = daysAgo(dateStr);
    if (a == null) return '';
    if (a <= 1) return ` (${dateStr})`;
    return ` (${dateStr}, vor ${a}d${a > 3 ? ' — VERALTET' : ''})`;
}

function summarizeHealth(summary) {
    if (!summary?.latest) return 'KEINE HEALTH-DATEN VERFÜGBAR — über Strava-Trend & Gefühl steuern.';
    const l = summary.latest;
    const lines = [];
    // Aktualität prüfen: der jüngste relevante Messwert.
    const ages = [l.hrv?.date, l.rhr?.date, l.sleep?.date].map(daysAgo).filter(a => a != null);
    const freshest = ages.length ? Math.min(...ages) : null;
    if (freshest != null && freshest > 3) {
        lines.push(`⚠ HEALTH-DATEN VERALTET (jüngster Wert vor ${freshest}d). Werte NICHT überbewerten — primär über Strava-Trend & subjektives Gefühl steuern, NICHT blind auf "HRV niedrig" alles downgraden.`);
    }
    if (l.rhr) lines.push(`Resting HR: ${l.rhr.value} bpm${ageTag(l.rhr.date)}`);
    if (l.hrv) lines.push(`HRV: ${l.hrv.value} ms${ageTag(l.hrv.date)}`);
    if (l.hrRecovery) lines.push(`Heart Recovery 1min: ${l.hrRecovery.value} bpm${ageTag(l.hrRecovery.date)}`);
    if (l.sleep) {
        const h = Math.floor(l.sleep.totalMin / 60);
        const m = l.sleep.totalMin % 60;
        lines.push(`Letzte erfasste Nacht: ${h}h ${m}m${ageTag(l.sleep.date)}`);
        if (l.sleep.stages) {
            const s = l.sleep.stages;
            lines.push(`  Stages: Deep ${s.deep || 0}m · REM ${s.rem || 0}m · Core ${s.core || 0}m · Awake ${s.awake || 0}m`);
        }
    }
    return lines.join('\n');
}

function summarizeHrvTrend(trend) {
    if (!trend || trend.length === 0) return '';
    const sorted = [...trend].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last7 = sorted.slice(-7);
    if (last7.length < 2) return '';
    const avg = last7.reduce((a, b) => a + b.value, 0) / last7.length;
    const first = last7[0].value;
    const last = last7[last7.length - 1].value;
    const dir = last > first + 2 ? 'steigend ↗' : last < first - 2 ? 'fallend ↘' : 'stabil →';
    return `HRV-Trend 7d: Ø ${avg.toFixed(0)} ms, ${dir} (${first}→${last})`;
}

function fmtPace(mps) {
    if (!mps || mps <= 0) return '–';
    const sec = Math.round(1000 / mps);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// Liefert { text, baseKm }. baseKm = Schnitt der letzten ABGESCHLOSSENEN
// Wochen mit Läufen (verrauscht-robust: ignoriert 0-Wochen). 0 wenn keine Daten.
function summarizeStrava(activities) {
    if (!activities || activities.length === 0) return { text: 'KEINE STRAVA-AKTIVITÄTEN VERFÜGBAR.', baseKm: 0 };
    const runs = activities.filter(a => a.type === 'Run');
    if (runs.length === 0) return { text: 'KEINE LÄUFE IN STRAVA.', baseKm: 0 };

    // Echte Kalenderwochen (Mo-So). Index 0 = laufende (unvollständige) Woche,
    // 1..4 = abgeschlossene Wochen davor.
    const thisWeekMon = mondayOf(new Date()).getTime();
    const week = 7 * 86400000;
    const buckets = [0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0];
    for (const r of runs) {
        const runMon = mondayOf(new Date(r.start_date_local)).getTime();
        const w = Math.round((thisWeekMon - runMon) / week);
        if (w >= 0 && w < 5) {
            buckets[w] += r.distance / 1000;
            counts[w]++;
        }
    }

    // Basis = Schnitt der abgeschlossenen Wochen MIT Läufen (0-Wochen raus).
    const done = [1, 2, 3, 4].map(i => buckets[i]).filter(km => km > 0);
    const baseKm = done.length ? done.reduce((a, b) => a + b, 0) / done.length : 0;

    const recent = runs.slice(0, 10).map(r => {
        const km = (r.distance / 1000).toFixed(1);
        const hr = r.average_heartrate ? `HR ${Math.round(r.average_heartrate)}` : '';
        return `  ${r.start_date_local.slice(0, 10)}  ${km} km @ ${fmtPace(r.average_speed)}/km ${hr}`;
    }).join('\n');

    const completed = [1, 2, 3, 4]
        .map(i => `  -${i}w (abgeschlossen): ${buckets[i].toFixed(1)} km (${counts[i]} Läufe)`)
        .join('\n');

    const text = `WOCHENVOLUMEN (Kalenderwochen Mo-So):
  laufende Woche: ${buckets[0].toFixed(1)} km (${counts[0]} Läufe) — UNVOLLSTÄNDIG, NICHT als Basis nutzen
${completed}

AKTUELLE BASIS (Schnitt abgeschlossener Wochen mit Läufen): ${baseKm.toFixed(1)} km

LETZTE 10 LÄUFE:
${recent}`;
    return { text, baseKm };
}

function buildPrompt({ health, hrvTrend, activities, weekStart }) {
    // Resttage: lokale Mitternacht beider Daten (kein UTC-Versatz).
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const md = new Date(`${MARATHON_DATE}T00:00:00`);
    const daysToMarathon = Math.max(0, Math.round((md - today) / 86400000));
    const weeksToMarathon = Math.ceil(daysToMarathon / 7);

    const strava = summarizeStrava(activities);
    const m = macroPlan(daysToMarathon, strava.baseKm);
    const qualityTxt = m.quality === 0 ? 'KEINE (nur Easy + Long)'
        : m.quality === 1 ? '1 Quality-Einheit'
        : `${m.quality} Quality-Einheiten`;

    return `Du bist Marathon-Trainer für Ole.

ATHLET: Ole, 193cm, 72kg, VWL-Student LMU München.
ZIEL: Marathon ${MARATHON_DATE} in ${TARGET_TIME} (Pace ${TARGET_PACE}) — ambitioniertes Stretch-Ziel.
HEUTE: T-${daysToMarathon} Tage (≈ ${weeksToMarathon} Wochen bis zum Marathon).

${HEALTH_CONSTRAINTS}

${COACH_PRINCIPLES}

ZIEL DIESE WOCHE (Makro-Anker — der rote Faden bis zum Marathon):
- Phase: ${m.phase}
- Ziel-Wochenvolumen: ~${m.weeklyKmTarget} km (aus aktueller Basis ${strava.baseKm.toFixed(1)} km progressiv abgeleitet)
- Empfohlene Laufeinheiten: ${m.runDays}
- Long Run: ~${m.longRunKm} km${m.mp ? ' (mit Marathon-Pace-Anteil 4:30/km einbauen)' : ''}
- Quality: ${qualityTxt}
- Fokus: ${m.focus}

DIAGNOSE: ${m.diagnosis}

${WEEK_FRAME}

AKTUELLER RECOVERY-STATUS:
${summarizeHealth(health)}
${summarizeHrvTrend(hrvTrend)}

TRAININGSHISTORIE:
${strava.text}

PROGRESSIONS-REGELN (zwingend):
- Orientiere dich am Ziel-Wochenvolumen oben, aber steigere ggü. der letzten realen Woche höchstens ~+10-12%. Liegt die Basis weit unter dem Ziel: schrittweise annähern, NIE auf einen Schlag hochspringen.
- Long Run ≤ ~35-40% des Wochenvolumens — keine isolierten Mammut-Läufe (z.B. 23 km bei sonst 12 km Wochenvolumen ist FALSCH).
- Easy strikt Z2 (5:15-5:40/km). Quality NUR in der oben vorgegebenen Anzahl. Bei niedriger AKTUELLER HRV oder schlechtem Schlaf → Quality zu Easy downgraden. Sind die Health-Daten veraltet (s.o.): NICHT blind downgraden, eher über Strava-Trend & Gefühl steuern.
- Reduktionswoche: wenn das Volumen ~3 Wochen in Folge gestiegen ist, plane DIESE Woche als Entlastung (-25 bis -30%).
- PRIORITÄT #1: Konsistenz — alle Laufeinheiten müssen real machbar sein. Lieber etwas weniger km, dafür sicher absolvierbar und verletzungsfrei.

AUFGABE:
Erstelle die Trainingswoche ab ${weekStart} (Mo-So, 7 Tage). Verteile das Volumen auf ~${m.runDays} Laufeinheiten.
Trage in "coachNote" ein: geplante Wochen-km, Anzahl Laufeinheiten, Hockey-Annahme + Handlungsempfehlung falls Hockey wegfällt.

ANTWORTE NUR ALS VALIDES JSON (keine Code-Fences, kein Text drumherum) NACH DIESEM SCHEMA:
{
  "weekStart": "YYYY-MM-DD",
  "phase": "Base" | "Build" | "Peak" | "Taper",
  "weeklyKm": <number>,
  "recommendedRunDays": <number>,
  "summary": "<1-Satz-Wochenziel auf Deutsch>",
  "coachNote": "<2-3 Sätze: geplante km, Anzahl Laufeinheiten, Hockey-Einplanung + was tun wenn Hockey wegfällt>",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "Mo" | "Di" | ...,
      "type": "Easy" | "Long" | "Tempo" | "Threshold" | "Intervals" | "Recovery" | "Cross" | "Rest" | "Yoga+Easy" | "Gym+Easy",
      "title": "<kurzer Workout-Name>",
      "distanceKm": <number or null>,
      "durationMin": <number or null>,
      "paceTarget": "<z.B. '5:20-5:40/km' oder null>",
      "hrZone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | null,
      "notes": "<1-2 Sätze: was/wie/warum, auf Deutsch>"
    }
  ]
}`;
}

async function callAnthropic({ apiKey, prompt, maxTokens = 4000 }) {
    const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Anthropic ${r.status}: ${txt}`);
    }
    const data = await r.json();
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function extractJson(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
    const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1].trim());
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error('no_json_in_response');
}

// Lokales Datum als YYYY-MM-DD — NICHT toISOString (das wäre UTC und kippt
// in DE-Zeitzone die lokale Mitternacht auf den Vortag).
function toLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Montag (lokal, 00:00) der Woche, in der `date` liegt.
function mondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function nextMonday() {
    const d = mondayOf(new Date());
    d.setDate(d.getDate() + 7);
    return toLocalISO(d);
}

function thisMonday() {
    return toLocalISO(mondayOf(new Date()));
}

const VALID_PHASES = ['Base', 'Build', 'Peak', 'Taper'];

function validatePlan(plan) {
    if (!plan || typeof plan !== 'object') throw new Error('plan_invalid: kein Objekt');
    if (!Array.isArray(plan.days) || plan.days.length !== 7) {
        throw new Error(`plan_invalid: 7 Tage erwartet, ${plan.days?.length ?? 0} erhalten`);
    }
    if (typeof plan.weeklyKm !== 'number' || !isFinite(plan.weeklyKm)) {
        throw new Error('plan_invalid: weeklyKm ist keine Zahl');
    }
    if (!VALID_PHASES.includes(plan.phase)) {
        throw new Error(`plan_invalid: unbekannte phase "${plan.phase}"`);
    }
    // Optionale Felder tolerant normalisieren.
    if (plan.recommendedRunDays != null && typeof plan.recommendedRunDays !== 'number') {
        const n = parseInt(plan.recommendedRunDays, 10);
        plan.recommendedRunDays = isFinite(n) ? n : undefined;
    }
    for (const d of plan.days) {
        if (!d || !d.date || !d.dayLabel || !d.type) {
            throw new Error(`plan_invalid: unvollständiger Tag ${JSON.stringify(d).slice(0, 80)}`);
        }
    }
    return plan;
}

async function generatePlan({ apiKey, health, hrvTrend, activities, weekStart }) {
    if (!apiKey) throw new Error('missing_api_key');
    const start = weekStart || thisMonday();
    const prompt = buildPrompt({ health, hrvTrend, activities, weekStart: start });
    const raw = await callAnthropic({ apiKey, prompt });
    const plan = validatePlan(extractJson(raw));
    plan.generatedAt = new Date().toISOString();
    plan.model = MODEL;
    return plan;
}

module.exports = { generatePlan, thisMonday, nextMonday, MARATHON_DATE, TARGET_TIME };
