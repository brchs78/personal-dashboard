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

// Fix 3 — Hockey als Qualitätsbelastung explizit rechnen.
const HOCKEY_LOAD = `HOCKEY-LAST (zwingend berücksichtigen):
- Di + Do Hockey = 2× hochintensive anaerobe Einheiten/Woche — diese zählen als Quality-Tage.
- Maximale harte Tage/Woche: 3. Hockey belegt bereits 2.
  → In Phase Build: nur 1× Lauf-Quality (nicht 2×), weil Hockey den zweiten Quality-Reiz liefert.
  → In Phase Base: Hockey = einzige Intensität der Woche. Läufe STRIKT Z2.
- Mo (nach Do-Hockey): Recovery-Tendenz — Easy eher kürzer/locker.
- Mi (nach Di-Hockey): angepasstes Easy, keine Zusatz-Belastung.`;

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

// Fix 5 — Tatsächlich absolvierte km aus Strava für eine Woche (IST, nicht Soll).
function mondayNWeeksAgo(n) {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff - n * 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

function actualWeekKm(weekStartISO, activities) {
    if (!activities || activities.length === 0) return 0;
    const start = new Date(weekStartISO).getTime();
    const end = start + 7 * 86400000;
    return activities
        .filter(a => a.type === 'Run')
        .filter(a => {
            const t = new Date(a.start_date_local).getTime();
            return t >= start && t < end;
        })
        .reduce((s, a) => s + a.distance / 1000, 0);
}

// Absolvierte km der Vorwoche — Strava-Ist, Fallback auf erledigte Plan-Tage.
function prevActualKm(prevPlan, done, activities) {
    if (prevPlan?.weekStart && activities?.length > 0) {
        const stravaKm = actualWeekKm(prevPlan.weekStart, activities);
        if (stravaKm > 0) return stravaKm;
    }
    // Fallback: nur erledigte Tage des letzten Plans summieren
    if (!prevPlan?.days) return 0;
    return prevPlan.days
        .filter(d => done?.[d.date])
        .reduce((s, d) => s + (d.distanceKm || 0), 0);
}

// Fix 1 — Readiness-Gate: Kalender gibt Obergrenze, Fitness entscheidet ob erreichbar.
function computeFitness(activities, history, hrvTrend) {
    // Strava-Ist-Volumen der letzten 3 Wochen
    const weeklyKm = [0, 1, 2].map(n => actualWeekKm(mondayNWeeksAgo(n), activities));
    const recentWeeklyKm = weeklyKm.find(km => km > 0) || 0;

    // Stabile Wochen: wie viele der letzten 3 Wochen ≥30 km?
    const stableWeeks = weeklyKm.filter(km => km >= 30).length;

    // Längster Lauf in letzten 4 Wochen
    const cutoff = Date.now() - 28 * 86400000;
    const lastLongRunKm = (activities || [])
        .filter(a => a.type === 'Run' && new Date(a.start_date_local).getTime() > cutoff)
        .reduce((m, a) => Math.max(m, a.distance / 1000), 0);

    // HRV-Richtung aus Trend
    let hrvDir = 'stable';
    if (hrvTrend && hrvTrend.length >= 2) {
        const last7 = hrvTrend.slice(-7);
        const first = last7[0].value;
        const last = last7[last7.length - 1].value;
        hrvDir = last < first - 2 ? 'falling' : last > first + 2 ? 'rising' : 'stable';
    }

    return { recentWeeklyKm, stableWeeks, lastLongRunKm, hrvDir };
}

function gatePhase(calendarPhase, fitness) {
    if (calendarPhase === 'Base' || calendarPhase === 'Taper') {
        return { phase: calendarPhase, phaseNote: null };
    }

    // Voraussetzungen für Build: 3 stabile Wochen ≥30 km + Long Run ≥18 km + HRV nicht fallend
    const readyForBuild = fitness.stableWeeks >= 3
        && fitness.recentWeeklyKm >= 45
        && fitness.lastLongRunKm >= 18
        && fitness.hrvDir !== 'falling';

    if (!readyForBuild) {
        return {
            phase: 'Base',
            phaseNote: `Kalender sagt ${calendarPhase}, aber Readiness-Check nicht erfüllt — Basis-km: ${fitness.recentWeeklyKm.toFixed(0)} km/Wo, Long Run: ${fitness.lastLongRunKm.toFixed(0)} km, stabile Wochen: ${fitness.stableWeeks}/3. Bleibe in Base bis Voraussetzungen erfüllt.`,
        };
    }

    // Voraussetzungen für Peak: ≥70 km/Wo über mind. 2 Wochen
    if (calendarPhase === 'Peak') {
        const readyForPeak = fitness.stableWeeks >= 2 && fitness.recentWeeklyKm >= 70;
        if (!readyForPeak) {
            return {
                phase: 'Build',
                phaseNote: `Kalender sagt Peak, aber Volumen noch nicht bei Peak-Niveau (${fitness.recentWeeklyKm.toFixed(0)} km, Ziel ≥70 km). Verbleibe in Build.`,
            };
        }
    }

    return { phase: calendarPhase, phaseNote: null };
}

// Fix 2 — Deload deterministisch zählen, nicht dem LLM überlassen.
function computeDeload(history, actualKmPrevWeek) {
    // Aufeinanderfolgende Nicht-Deload-Wochen rückwärts zählen
    const recent = [...history].reverse().slice(0, 4);
    let streak = 0;
    for (const week of recent) {
        if (week.isDeload) break;
        streak++;
    }
    const forceDeload = streak >= 3;
    const targetKm = forceDeload ? Math.round((actualKmPrevWeek || 30) * 0.8) : null;
    return { forceDeload, streak, targetKm };
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

function buildPrompt({ health, hrvTrend, activities, weekStart, prevPlan, history, done,
    availableRunDays, phase, phaseNote, recommendedRunDays, deload, actualPrevKm }) {
    const daysToMarathon = Math.max(0, Math.round((new Date(MARATHON_DATE) - new Date(weekStart)) / 86400000));
    const runDays = availableRunDays || recommendedRunDays;

    // Fix 2 — Deload-Direktive als nicht-verhandelbare Anweisung
    const deloadDirective = deload.forceDeload
        ? `\n⚠️ ENTLASTUNGSWOCHE PFLICHT (${deload.streak} Steigerungswochen in Folge): Ziel-km = ${deload.targetKm} km (-20%). isDeload MUSS true sein. Kein Threshold, kein Quality-Block.`
        : '';

    return `Du bist Marathon-Trainer für Ole.

ATHLET: Ole, 193cm, 72kg, VWL-Student LMU München.
ZIEL: Marathon ${MARATHON_DATE} in ${TARGET_TIME} (Pace ${TARGET_PACE}).
WOCHENSTART ${weekStart}: T-${daysToMarathon} Tage → ${weeksToMarathon(weekStart)} Wochen bis Marathon.

AKTUELLE PHASE: ${phase}${phaseNote ? `\n⚠️ PHASEN-HINWEIS: ${phaseNote}` : ''}
${phaseInstruction(phase)}${deloadDirective}

${HEALTH_CONSTRAINTS}

${HOCKEY_LOAD}

${COACH_PRINCIPLES}

${PHASE_GUIDE}

${WEEK_FRAME}

VERFÜGBARKEIT DIESE WOCHE: Ole kann an ${runDays} Tagen laufen (Coach-Empfehlung: ${recommendedRunDays}).
Verteile das Wochenvolumen auf GENAU ${runDays} Lauftage. Bei ≤3 → Mo/Mi/Sa. Bei 4 → + kurzer So-Recovery-Run (Z1). Bei 5 → zusätzlich einen Lauftag splitten. Di/Do Hockey + Fr Rad bleiben immer frei.

AKTUELLER RECOVERY-STATUS:
${summarizeHealth(health)}
${summarizeHrvTrend(hrvTrend)}

PLAN-GEDÄCHTNIS (SOLL — was geplant war):
${summarizePrevPlan(prevPlan, done)}
${summarizeHistory(history)}

STRAVA-HISTORIE (IST — was tatsächlich gelaufen wurde):
${summarizeStrava(activities)}

PROGRESSION (Fix 5 — immer auf IST-Basis, niemals auf Soll-Basis):
- Progressionsbasis = tatsächlich gelaufene km laut Strava-IST der Vorwoche: ${actualPrevKm > 0 ? actualPrevKm.toFixed(0) + ' km' : 'kein Strava-Wert → Vorwoche-Plan als Fallback'}.
- NICHT auf Soll-Plan-km basieren — nur auf was Ole wirklich absolviert hat.
- Steigere max. +10% vs. IST-Basis. Long Run ≤ 33% des Wochenvolumens.
- Bei niedriger HRV / schlechtem Schlaf → Quality zu Easy downgraden.

AUFGABE:
1. Erstelle die Trainingswoche ab ${weekStart} (Mo-So, 7 Tage) für Phase ${phase}.
2. Gib einen kurzen Ausblick auf die NÄCHSTE Woche (Ziel-km + Fokus).

ANTWORTE NUR ALS VALIDES JSON (keine Code-Fences, kein Text drumherum) NACH DIESEM SCHEMA:
{
  "weekStart": "YYYY-MM-DD",
  "phase": "Base" | "Build" | "Peak" | "Taper",
  "weeklyKm": <number>,
  "runDays": ${runDays},
  "isDeload": <true wenn Entlastungswoche, sonst false>,
  "summary": "<1-Satz-Wochenziel auf Deutsch>",
  "coachNote": "<1-2 Sätze: Begründung Volumen/Frequenz, ggf. Kommentar Lauftage vs. Empfehlung>",
  "phaseNote": ${phaseNote ? `"${phaseNote.replace(/"/g, "'")}"` : 'null'},
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

    // Fix 5 — IST-Basis: echte absolvierte km der Vorwoche
    const actualPrevKm = prevActualKm(prevPlan, done, activities);

    // Fix 1 — Readiness-Gate: Kalender gibt Obergrenze, Fitness entscheidet
    const calendarPhase = computePhase(start);
    const fitness = computeFitness(activities, history, hrvTrend);
    const { phase, phaseNote } = gatePhase(calendarPhase, fitness);

    // Fix 2 — Deload deterministisch berechnen
    const deload = computeDeload(history, actualPrevKm);

    // Fix 5 — Empfehlung auf IST-Basis
    const recommendedRunDays = recommendRunDays(actualPrevKm);

    const prompt = buildPrompt({
        health, hrvTrend, activities, weekStart: start,
        prevPlan, history, done, availableRunDays,
        phase, phaseNote, recommendedRunDays, deload, actualPrevKm,
    });
    const raw = await callAnthropic({ apiKey, prompt });
    const plan = extractJson(raw);

    // Phase ist autoritativ (Fix 1), Deload wird erzwungen (Fix 2)
    plan.phase = phase;
    plan.phaseNote = phaseNote || plan.phaseNote || null;
    if (deload.forceDeload) {
        plan.isDeload = true;
        plan.deloadEnforced = true; // Flag für UI
    }
    plan.actualPrevKm = Math.round(actualPrevKm);
    plan.generatedAt = new Date().toISOString();
    plan.model = MODEL;
    return plan;
}

module.exports = {
    generatePlan, computePhase, gatePhase, computeDeload, recommendRunDays,
    actualWeekKm, weeksToMarathon, thisMonday, nextMonday, MARATHON_DATE, TARGET_TIME,
};
