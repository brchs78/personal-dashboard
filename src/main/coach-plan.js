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
- So: Standard = REST + Yoga/Mobility. NUR wenn Verfügbarkeit ≥4 Lauftage verlangt → kurzer Recovery-Run (Z1, 5-6 km).

WICHTIG: Di und Do sind IMMER Hockey — niemals dort einen Lauf einplanen. Lauf-km verteilen sich auf Mo, Mi, Sa (+ optional So bei ≥4 Lauftagen).`;

const PHASE_GUIDE = `PHASEN-MODELL (Makrozyklus bis Marathon):
- Phase 1 (Base, >12 Wochen vor Marathon): NUR Z2/Easy + Long Run. KEINE Intervalle. Volumen progressiv aufbauen.
- Phase 2 (Build, 7-12 Wochen vorher): 1× Threshold + 1× Marathon-Pace-Block, Volumen weiter steigern.
- Phase 3 (Peak, 4-6 Wochen vorher): 2× Quality, Long Runs >32 km, Peak-Volumen.
- Phase 4 (Taper, letzte 3 Wochen): -40% Volumen, Intensität halten.`;

const COACH_PRINCIPLES = `COACH-PRINZIPIEN:
- 80/20 Polarized: 80% Z2 Easy, 20% Quality.
- "Volume first, Speed later" — Mitochondrien vor Schnelligkeit.
- HRV-basiertes Adjust: HRV niedrig → Quality zu Easy downgraden.
- +10% Wochenregel: niemals mehr als 10% Steigerung Woche-zu-Woche.
- 3:1-Mesozyklus: nach 3 Steigerungswochen eine Entlastungswoche (-20% Volumen).
- Long Run ≤ 33% des Wochenvolumens (Verletzungsschutz).
- Easy-Pace strikt 5:15-5:40/km (Z2, 130-150 bpm). Wenn schneller → BREMSEN.
- Marathon-Pace = 4:30/km (Sub-3:10). Threshold = 4:00-4:10/km. Intervalle = 3:45-3:55/km.`;

const HEALTH_CONSTRAINTS = `GESUNDHEIT & BELASTUNGS-STEUERUNG:
- Recovery hat Vorrang: bei niedriger HRV / schlechtem Schlaf Intensität sofort senken.
- Kein Schwimmen/Pool, kein schweres Maximal-Gewichtheben.
- Intensität (Threshold/Intervalle) nur in Phase Build/Peak — in Base strikt Z1-2.
- Bei Erschöpfungssignalen lieber einen Tag mehr Easy als zu früh pushen.`;

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
    const last7 = trend.slice(-7);
    if (last7.length < 2) return '';
    const avg = last7.reduce((a, b) => a + b.value, 0) / last7.length;
    const first = last7[0].value;
    const last = last7[last7.length - 1].value;
    const dir = last > first + 2 ? 'steigend ↗' : last < first - 2 ? 'fallend ↘' : 'stabil →';
    return `HRV-Trend 7d: Ø ${avg.toFixed(0)} ms, ${dir} (${first}→${last})`;
}

function summarizeStrava(activities) {
    if (!activities || activities.length === 0) return 'KEINE STRAVA-AKTIVITÄTEN VERFÜGBAR.';
    const runs = activities.filter(a => a.type === 'Run').slice(0, 20);
    if (runs.length === 0) return 'KEINE LÄUFE IN STRAVA.';

    // Weekly mileage last 4 weeks
    const now = Date.now();
    const week = 7 * 86400000;
    const buckets = [0, 0, 0, 0];
    const counts = [0, 0, 0, 0];
    for (const r of runs) {
        const age = now - new Date(r.start_date_local).getTime();
        const w = Math.floor(age / week);
        if (w >= 0 && w < 4) {
            buckets[w] += r.distance / 1000;
            counts[w]++;
        }
    }

    const recent = runs.slice(0, 10).map(r => {
        const km = (r.distance / 1000).toFixed(1);
        const mps = r.average_speed || 0;
        const pace = mps > 0 ? `${Math.floor(1000 / mps / 60)}:${String(Math.round((1000 / mps) % 60)).padStart(2, '0')}` : '–';
        const hr = r.average_heartrate ? `HR ${Math.round(r.average_heartrate)}` : '';
        return `  ${r.start_date_local.slice(0, 10)}  ${km} km @ ${pace}/km ${hr}`;
    }).join('\n');

    const weekly = buckets.map((km, i) => `  -${i}w: ${km.toFixed(1)} km (${counts[i]} Läufe)`).join('\n');

    return `WOCHENVOLUMEN (letzte 4 Wochen):
${weekly}

LETZTE 10 LÄUFE:
${recent}`;
}

// #1 — Datums-getriebener Phasenwechsel: Phase ergibt sich aus Wochen bis Marathon.
function weeksToMarathon(weekStart) {
    const start = new Date(weekStart);
    return Math.max(0, Math.round((new Date(MARATHON_DATE) - start) / (7 * 86400000)));
}

function computePhase(weekStart) {
    const w = weeksToMarathon(weekStart);
    if (w <= 3) return 'Taper';
    if (w <= 6) return 'Peak';
    if (w <= 12) return 'Build';
    return 'Base';
}

function phaseInstruction(phase) {
    switch (phase) {
        case 'Taper':
            return 'PHASE 4 TAPER: Volumen -40% vs. Peak. Kurze MP-/Threshold-Reize zum Frischhalten, keine erschöpfenden Long Runs. Ziel: ausgeruht an die Startlinie.';
        case 'Peak':
            return 'PHASE 3 PEAK: 2× Quality/Woche (Threshold + MP-Block), Long Run >32 km, Peak-Volumen. Höchste Spezifität.';
        case 'Build':
            return 'PHASE 2 BUILD: 1× Threshold (4:00-4:10) + 1× Marathon-Pace-Block (4:30) pro Woche. Volumen weiter steigern. Easy bleibt Z2.';
        default:
            return 'PHASE 1 BASE: NUR Z2/Easy + Long Run. KEINE Intervalle/Threshold. Aerobe Basis & Volumen aufbauen.';
    }
}

// Empfohlene Lauftage abhängig vom Vorwochen-Volumen (Long Run ≤33%-Regel als Treiber).
function recommendRunDays(lastWeeklyKm) {
    const km = lastWeeklyKm || 0;
    if (km >= 75) return 5;
    if (km >= 50) return 4;
    return 3;
}

function planVolume(plan) {
    if (!plan?.days) return 0;
    return plan.days.reduce((s, d) => s + (d.distanceKm || 0), 0);
}

// #3 — Plan-Gedächtnis: Vorwoche + Volumen-Verlauf für echte Progression.
function summarizePrevPlan(prevPlan, done) {
    if (!prevPlan) return 'KEIN VORWOCHEN-PLAN (dies ist der erste Plan — vorsichtig starten, an Strava-Volumen orientieren).';
    const total = planVolume(prevPlan);
    const days = prevPlan.days || [];
    const doneCount = days.filter((d) => done?.[d.date]).length;
    const longRun = days.reduce((m, d) => Math.max(m, d.distanceKm || 0), 0);
    return `VORWOCHE (${prevPlan.weekStart}, Phase ${prevPlan.phase}): ${total.toFixed(0)} km geplant · ${doneCount}/${days.length} erledigt · längster Lauf ${longRun.toFixed(0)} km.`;
}

function summarizeHistory(history) {
    if (!history || history.length === 0) return '';
    const rows = history.slice(-5).map((p) => `  ${p.weekStart}: ${planVolume(p).toFixed(0)} km (${p.phase})`);
    return `VOLUMEN-VERLAUF (letzte Wochen, für +10%- und 3:1-Deload-Regel):\n${rows.join('\n')}`;
}

function buildPrompt({ health, hrvTrend, activities, weekStart, prevPlan, history, done, availableRunDays, phase, recommendedRunDays }) {
    const daysToMarathon = Math.max(0, Math.round((new Date(MARATHON_DATE) - new Date(weekStart)) / 86400000));
    const prevTotal = planVolume(prevPlan);
    const runDays = availableRunDays || recommendedRunDays;

    return `Du bist Marathon-Trainer für Ole.

ATHLET: Ole, 193cm, 72kg, VWL-Student LMU München.
ZIEL: Marathon ${MARATHON_DATE} in ${TARGET_TIME} (Pace ${TARGET_PACE}).
WOCHENSTART ${weekStart}: T-${daysToMarathon} Tage → ${weeksToMarathon(weekStart)} Wochen bis Marathon.

AKTUELLE PHASE: ${phase}
${phaseInstruction(phase)}

${HEALTH_CONSTRAINTS}

${COACH_PRINCIPLES}

${PHASE_GUIDE}

${WEEK_FRAME}

VERFÜGBARKEIT DIESE WOCHE: Ole kann an ${runDays} Tagen laufen (Empfehlung des Coaches wäre ${recommendedRunDays}).
Verteile das Wochenvolumen auf GENAU ${runDays} Lauftage. Bei ≤3 → Mo/Mi/Sa. Bei 4 → + kurzer So-Recovery-Run (Z1). Bei 5 → zusätzlich einen Lauftag splitten. Di/Do Hockey + Fr Rad bleiben immer frei.

AKTUELLER RECOVERY-STATUS:
${summarizeHealth(health)}
${summarizeHrvTrend(hrvTrend)}

PLAN-GEDÄCHTNIS:
${summarizePrevPlan(prevPlan, done)}
${summarizeHistory(history)}

STRAVA-HISTORIE:
${summarizeStrava(activities)}

PROGRESSION (datengetrieben):
- Basiere das Volumen auf der VORWOCHE (${prevTotal > 0 ? prevTotal.toFixed(0) + ' km' : 'kein Vorwert → Strava-Volumen nutzen'}), nicht auf einem festen Startwert.
- Steigere max. +10% vs. Vorwoche. Wenn der Volumen-Verlauf 3 Steigerungswochen in Folge zeigt → DIESE Woche Entlastung (-20%).
- Long Run ≤ 33% des Wochenvolumens.
- Bei niedriger HRV / schlechtem Schlaf → Quality zu Easy downgraden.

AUFGABE:
1. Erstelle die Trainingswoche ab ${weekStart} (Mo-So, 7 Tage) für Phase ${phase}.
2. Gib zusätzlich einen kurzen Ausblick auf die NÄCHSTE Woche (Ziel-km + Fokus), damit Ole die Richtung sieht.

ANTWORTE NUR ALS VALIDES JSON (keine Code-Fences, kein Text drumherum) NACH DIESEM SCHEMA:
{
  "weekStart": "YYYY-MM-DD",
  "phase": "Base" | "Build" | "Peak" | "Taper",
  "weeklyKm": <number>,
  "runDays": ${runDays},
  "isDeload": <true wenn Entlastungswoche, sonst false>,
  "summary": "<1-Satz-Wochenziel auf Deutsch>",
  "coachNote": "<1-2 Sätze: warum dieses Volumen/diese Frequenz, ggf. Kommentar zur gewählten Lauftage-Anzahl vs. Empfehlung>",
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
  ],
  "nextWeekPreview": {
    "phase": "Base" | "Build" | "Peak" | "Taper",
    "targetKm": <number>,
    "focus": "<1 Satz: Schwerpunkt nächste Woche auf Deutsch>"
  }
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

function nextMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : (8 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function thisMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

async function generatePlan({ apiKey, health, hrvTrend, activities, weekStart, prevPlan, history, done, availableRunDays }) {
    if (!apiKey) throw new Error('missing_api_key');
    const start = weekStart || thisMonday();
    const phase = computePhase(start);
    const recommendedRunDays = recommendRunDays(planVolume(prevPlan));
    const prompt = buildPrompt({
        health, hrvTrend, activities, weekStart: start,
        prevPlan, history, done, availableRunDays,
        phase, recommendedRunDays,
    });
    const raw = await callAnthropic({ apiKey, prompt });
    const plan = extractJson(raw);
    plan.phase = phase; // Phase ist datums-autoritativ, nicht vom LLM überschreibbar
    plan.generatedAt = new Date().toISOString();
    plan.model = MODEL;
    return plan;
}

module.exports = { generatePlan, computePhase, recommendRunDays, weeksToMarathon, thisMonday, nextMonday, MARATHON_DATE, TARGET_TIME };
