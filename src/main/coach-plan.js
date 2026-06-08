// OLE OS — KI-Trainingsplan-Generator
// Sammelt Health-Snapshot + Strava-History, baut Prompt, ruft Anthropic API.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

const MARATHON_DATE = '2026-10-11';
const TARGET_TIME = '3:10';
const TARGET_PACE = '4:30/km';

const WEEK_FRAME = `WOCHEN-RAHMEN (fest, nicht ändern):
- Mo: Easy Run + Yoga (morgens)
- Di: Hockey-Training (kein Lauf — Sport ist gesetzt, zählt als Cross-Training/Spielsport)
- Mi: Easy Run + Gym
- Do: Hockey-Training (kein Lauf — Sport ist gesetzt)
- Fr: Radfahren (Cross-Training, KEIN Lauf)
- Sa: Long Run (Hauptlauf der Woche)
- So: REST DAY — nur Yoga + Mobility/Flexibility (kein Lauf, kein Sport)

WICHTIG: Di und Do sind IMMER Hockey. Niemals dort einen Lauf einplanen. So ist IMMER reiner Rest/Yoga-Tag. Die Lauf-km verteilen sich ausschließlich auf Mo, Mi, Sa.`;

const PHASE_GUIDE = `PERIODISIERUNG (Referenz, gesamter Zyklus):
- Base: NUR Z2/Easy + Long Run. KEINE Intervalle. Volumen 25→60 km/Woche.
- Build: 1× Threshold + 1× Marathon-Pace-Block, 70-80 km/Woche.
- Peak: 2× Quality, Long Runs >32 km, 80-90 km/Woche Peak.
- Taper (letzte 3 Wochen): -40% Volumen, Intensität halten.`;

// Aktive Phase aus Resttagen bis zum Marathon ableiten — NICHT statisch.
function derivePhase(daysToMarathon) {
    if (daysToMarathon <= 21) return {
        phase: 'Taper',
        focus: 'Volumen -40%, Intensität halten. Frische aufbauen, kein neues Volumen.',
        diagnosis: 'Taper-Phase: Erholung priorisieren, Schärfe halten, Beine frisch bekommen. Kurze MP-Touches, kein Volumen-Aufbau mehr.',
    };
    if (daysToMarathon <= 56) return {
        phase: 'Peak',
        focus: '2× Quality/Woche, Long Runs >32 km, 80-90 km Peak-Volumen.',
        diagnosis: 'Peak-Phase: Marathon-spezifische Härte. Long Runs mit Marathon-Pace-Blöcken, 2× Quality, höchstes Volumen des Zyklus.',
    };
    if (daysToMarathon <= 112) return {
        phase: 'Build',
        focus: '1× Threshold + 1× Marathon-Pace-Block, 70-80 km/Woche.',
        diagnosis: 'Build-Phase: Schwelle + Marathon-Pace einführen. Volumen weiter steigern, jetzt mit gezielter Qualität — NICHT mehr reines Base-Building.',
    };
    return {
        phase: 'Base',
        focus: 'NUR Z2/Easy + Long Run, keine Intervalle. Volumen 25→60 km/Woche.',
        diagnosis: 'Base-Phase: Aerobe Basis bauen. Volumen vor Tempo, Mitochondrien-Aufbau. Noch keine Intervalle.',
    };
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

function summarizeHealth(summary) {
    if (!summary?.latest) return 'KEINE HEALTH-DATEN VERFÜGBAR.';
    const l = summary.latest;
    const lines = [];
    if (l.rhr) lines.push(`Resting HR: ${l.rhr.value} bpm (${l.rhr.date})`);
    if (l.hrv) lines.push(`HRV: ${l.hrv.value} ms (${l.hrv.date})`);
    if (l.hrRecovery) lines.push(`Heart Recovery 1min: ${l.hrRecovery.value} bpm (${l.hrRecovery.date})`);
    if (l.sleep) {
        const h = Math.floor(l.sleep.totalMin / 60);
        const m = l.sleep.totalMin % 60;
        lines.push(`Letzte Nacht Schlaf: ${h}h ${m}m (${l.sleep.date})`);
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

function summarizeStrava(activities) {
    if (!activities || activities.length === 0) return 'KEINE STRAVA-AKTIVITÄTEN VERFÜGBAR.';
    const runs = activities.filter(a => a.type === 'Run');
    if (runs.length === 0) return 'KEINE LÄUFE IN STRAVA.';

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

    const recent = runs.slice(0, 10).map(r => {
        const km = (r.distance / 1000).toFixed(1);
        const hr = r.average_heartrate ? `HR ${Math.round(r.average_heartrate)}` : '';
        return `  ${r.start_date_local.slice(0, 10)}  ${km} km @ ${fmtPace(r.average_speed)}/km ${hr}`;
    }).join('\n');

    const completed = [1, 2, 3, 4]
        .map(i => `  -${i}w (abgeschlossen): ${buckets[i].toFixed(1)} km (${counts[i]} Läufe)`)
        .join('\n');

    return `WOCHENVOLUMEN (Kalenderwochen Mo-So):
  laufende Woche: ${buckets[0].toFixed(1)} km (${counts[0]} Läufe) — UNVOLLSTÄNDIG, NICHT als +10%-Basis nutzen
${completed}

+10%-BASIS = letzte abgeschlossene Woche: ${buckets[1].toFixed(1)} km

LETZTE 10 LÄUFE:
${recent}`;
}

function buildPrompt({ health, hrvTrend, activities, weekStart }) {
    const daysToMarathon = Math.max(0, Math.round((new Date(MARATHON_DATE) - new Date()) / 86400000));
    const { phase, focus, diagnosis } = derivePhase(daysToMarathon);

    return `Du bist Marathon-Trainer für Ole.

ATHLET: Ole, 193cm, 72kg, VWL-Student LMU München.
ZIEL: Marathon ${MARATHON_DATE} in ${TARGET_TIME} (Pace ${TARGET_PACE}).
HEUTE: T-${daysToMarathon} Tage.

${HEALTH_CONSTRAINTS}

${COACH_PRINCIPLES}

${PHASE_GUIDE}

AKTIVE PHASE: ${phase} (T-${daysToMarathon} Tage bis Marathon)
PHASEN-FOKUS: ${focus}

${WEEK_FRAME}

AKTUELLER RECOVERY-STATUS:
${summarizeHealth(health)}
${summarizeHrvTrend(hrvTrend)}

TRAININGSHISTORIE:
${summarizeStrava(activities)}

DIAGNOSE: ${diagnosis}

AUFGABE:
Erstelle die Trainingswoche ab ${weekStart} (Mo-So, 7 Tage).
Berücksichtige Recovery-Status: bei niedriger HRV oder schlechtem Schlaf → Easy statt Quality.
Halte +10%-Regel ein basierend auf Wochenvolumen oben.

ANTWORTE NUR ALS VALIDES JSON (keine Code-Fences, kein Text drumherum) NACH DIESEM SCHEMA:
{
  "weekStart": "YYYY-MM-DD",
  "phase": "Base" | "Build" | "Peak" | "Taper",
  "weeklyKm": <number>,
  "summary": "<1-Satz-Wochenziel auf Deutsch>",
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
