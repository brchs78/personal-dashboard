import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Health from "./components/Health";
import TrainingPlan from "./components/TrainingPlan";
import tokens from "./styles/tokens";

// ── Speicher-Adapter: nutzt window.storage (Claude) oder localStorage (Electron) ──
const store = (typeof window !== "undefined" && window.storage) ? window.storage : {
    get: async (k) => { const v = localStorage.getItem(k); return v !== null ? { value: v } : null; },
    set: async (k, v) => { localStorage.setItem(k, v); },
};
const getKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("ole:api-key") || "" : "");

// ── Colors ── (Magenta-Indigo Palette)
const SP = { acc: "#c026d3", bg: "rgba(192,38,211,0.10)", br: "rgba(192,38,211,0.25)" };
const UN = { acc: "#6366f1", bg: "rgba(99,102,241,0.10)", br: "rgba(99,102,241,0.25)" };
const BD = { acc: "#a855f7", bg: "rgba(168,85,247,0.10)", br: "rgba(168,85,247,0.25)" };
const KL = { acc: "#818cf8", bg: "rgba(129,140,248,0.10)", br: "rgba(129,140,248,0.25)" };
const GBL = "#312e81";

function getZone(hr, maxHR) {
    const pct = hr / maxHR;
    if (pct < 0.6) return { z: 1, name: "Zone 1", color: "#818cf8", desc: "Aktive Erholung" };
    if (pct < 0.7) return { z: 2, name: "Zone 2", color: "#6366f1", desc: "Aerob / Fettverbrennung" };
    if (pct < 0.8) return { z: 3, name: "Zone 3", color: "#8b5cf6", desc: "Aerob-Anaerob Mix" };
    if (pct < 0.9) return { z: 4, name: "Zone 4", color: "#a855f7", desc: "Threshold" };
    return { z: 5, name: "Zone 5", color: "#c026d3", desc: "VO2max / Maximal" };
}
function calcRecovery(restHR, sleepHrs, stress) {
    const hr = Math.max(0, Math.min(10, (80 - Math.max(40, Math.min(80, restHR))) / 40 * 10));
    const sl = Math.max(0, Math.min(10, (sleepHrs - 4) / 5 * 10));
    const st = stress !== null ? Math.max(0, 10 - stress * 2.5) : 5;
    return Math.round((hr * 0.4 + sl * 0.35 + st * 0.25) * 10) / 10;
}
function getCalDays(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
}

function gTxt(a, b) {
    return { background: `linear-gradient(135deg,${a},${b})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
}
function blockClr(t) { return t === "sport" ? SP : t === "uni" ? UN : { acc: "#999", bg: "rgba(128,128,128,0.06)", br: "rgba(128,128,128,0.12)" }; }
function dTo(d) { const dt = new Date(d), n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(0, Math.round((dt - n) / 86400000)); }
function fmtT(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function getWeekDates() {
    const now = new Date(), day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
function dk(d) { return d.toISOString().split("T")[0]; }

const PROFILE = `Du bist Oles persönlicher KI-Sportcoach und Life-Optimierer.
IDENTITÄT: Ole, VWL-Student 2. Semester, LMU München. 193cm, 72kg.
TRAINING: Volume over Speed. Marathon Sub 3:10h (Pace 4:30/km) am 11.10.2026. Zone-2-Laufen ist Kern. Aktuell Phase 1 Base-Building.
WOCHE: Mo Easy+Yoga · Di Hockey · Mi Easy+Gym · Do Hockey · Fr Rad · Sa Long Run · So Rest (Yoga+Mobility). Lauf-km nur Mo/Mi/Sa.
PHYSIOLOGIE: Starkes KV-System. Schwäche: Periphere Muskulatur acidifiziert bei Threshold.
STATUS: Post-Weisheitszahn-OP + Antibiotika. Erlaubt: Zone 1–2, Hockey, Rad, Yoga. Verboten: Pool, Schwerheben, Max-Intensität. Heilung hat Vorrang.
Antworte auf Deutsch. Direkt wie ein Elite-Coach.`;

const WG = [40, 0, 55, 40, 0, 80, 30];
const DL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const FEELINGS = ["😴", "😕", "😐", "😊", "🔥"];
const SLEEP_QUAL = ["😴", "😕", "😐", "😊", "💎"];
const STRESS_LVL = ["😌", "🙂", "😐", "😓", "🤯"];

const DEF_COURSES = [
    { id: 1, name: "Mikroökonomik I", short: "Mikro", days: ["Mo", "Mi"], time: "08:15", room: "HGH E006", ects: 6 },
    { id: 2, name: "Statistik I", short: "Stat", days: ["Di", "Do"], time: "10:15", room: "HGB B101", ects: 6 },
    { id: 3, name: "Mathe für WiWi II", short: "Mathe", days: ["Mo", "Fr"], time: "12:15", room: "HGB D209", ects: 6 },
    { id: 4, name: "Makroökonomik I", short: "Makro", days: ["Di", "Do"], time: "14:15", room: "HGH E006", ects: 6 },
];
const DEF_EXAMS = [
    { id: 1, name: "Statistik I", date: "2026-07-15" },
    { id: 2, name: "Mikroökonomik I", date: "2026-07-22" },
    { id: 3, name: "Mathe für WiWi II", date: "2026-07-29" },
];

async function callAI(messages, maxTok = 800) {
    const key = getKey();
    const headers = { "Content-Type": "application/json" };
    if (key) {
        headers["x-api-key"] = key;
        headers["anthropic-version"] = "2023-06-01";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: maxTok, system: PROFILE, messages }),
    });
    const d = await r.json();
    return d.content.filter(b => b.type === "text").map(b => b.text).join("");
}

const INP = { width: "100%", boxSizing: "border-box", fontSize: 14, padding: "9px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", outline: "none" };
const BINP = { ...INP, fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" };
const LBL = { fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 5px", display: "block" };

export default function App() {
    const [tab, setTab] = useState("dash");
    const [uTab, setUTab] = useState("pruefungen");
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState(getKey());
    const [keySet, setKeySet] = useState(!!getKey());

    const [plan, setPlan] = useState(null);
    const [planBusy, setPlanBusy] = useState(true);
    const [todos, setTodos] = useState([]);
    const [todoTxt, setTodoTxt] = useState("");
    const [todoCat, setTodoCat] = useState("Sport");

    const [weekRuns, setWeekRuns] = useState({});
    const [upBusy, setUpBusy] = useState(false);
    const [upMsg, setUpMsg] = useState("");
    const [nutrition, setNutrition] = useState(null);
    const [nutBusy, setNutBusy] = useState(false);
    const [dur, setDur] = useState(""); const [dist, setDist] = useState("");
    const [wHR, setWHR] = useState(""); const [feel, setFeel] = useState(null);
    const [wNote, setWNote] = useState(""); const [wAna, setWAna] = useState(null); const [wBusy, setWBusy] = useState(false);

    const [exams, setExams] = useState(DEF_EXAMS);
    const [grades, setGrades] = useState([]);
    const [uNotes, setUNotes] = useState([]);
    const [exName, setExName] = useState(""); const [exDate, setExDate] = useState("");
    const [gCrs, setGCrs] = useState(""); const [gVal, setGVal] = useState(""); const [gEcts, setGEcts] = useState("");
    const [nTop, setNTop] = useState(""); const [nBusy, setNBusy] = useState(false);

    const [pomSubj, setPomSubj] = useState("Mikro");
    const [pomSecs, setPomSecs] = useState(25 * 60);
    const [pomRun, setPomRun] = useState(false); const [pomBreak, setPomBreak] = useState(false); const [pomCount, setPomCount] = useState(0);
    const pomRef = useRef(null);

    const [msgs, setMsgs] = useState([]);
    const [chatTxt, setChatTxt] = useState(""); const [chatBusy, setChatBusy] = useState(false);
    const endRef = useRef(null);

    // ── NEW STATE ──
    const [bodyTab, setBodyTab] = useState("schlaf");
    const [sleepLog, setSleepLog] = useState([]);
    const [weightLog, setWeightLog] = useState([]);
    const [recoveryLog, setRecoveryLog] = useState([]);
    const [sleepH, setSleepH] = useState(""); const [sleepQ, setSleepQ] = useState(null);
    const [wgInput, setWgInput] = useState("");
    const [rstHR, setRstHR] = useState(""); const [rstStress, setRstStress] = useState(null);
    const [maxHR, setMaxHR] = useState(197);
    const [tPlan, setTPlan] = useState(null); const [tPlanBusy, setTPlanBusy] = useState(false);
    const [weekReview, setWeekReview] = useState(null); const [wrBusy, setWrBusy] = useState(false);
    const [flashcards, setFlashcards] = useState({}); const [fcBusy, setFcBusy] = useState(false);
    const [fcNoteId, setFcNoteId] = useState(null);
    const [fcIdx, setFcIdx] = useState(0); const [fcFlipped, setFcFlipped] = useState(false);
    const [studyPlans, setStudyPlans] = useState({}); const [spBusy, setSpBusy] = useState(null);
    const [calDate, setCalDate] = useState(new Date());

    useEffect(() => {
        loadAll();
        // Escape blendet Fenster aus (Electron)
        const onKey = (e) => { if (e.key === "Escape" && window.oleAPI) window.oleAPI.hideWindow(); };
        window.addEventListener("keydown", onKey);
        // Reagiere auf automatische Morgen-Routine
        if (window.oleAPI?.onRoutine) window.oleAPI.onRoutine((id) => { if (id === "morning") { setTab("dash"); genPlan(); } });
        return () => { clearInterval(pomRef.current); window.removeEventListener("keydown", onKey); };
    }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
    useEffect(() => {
        if (pomRun) {
            pomRef.current = setInterval(() => {
                setPomSecs(s => {
                    if (s <= 1) {
                        clearInterval(pomRef.current); setPomRun(false);
                        if (!pomBreak) { setPomCount(c => c + 1); setPomBreak(true); return 5 * 60; }
                        else { setPomBreak(false); return 25 * 60; }
                    }
                    return s - 1;
                });
            }, 1000);
        } else clearInterval(pomRef.current);
        return () => clearInterval(pomRef.current);
    }, [pomRun, pomBreak]);

    function saveKey() {
        localStorage.setItem("ole:api-key", apiKey.trim());
        setKeySet(!!apiKey.trim());
        setShowSettings(false);
        if (apiKey.trim()) { genPlan(); loadNutrition(); }
    }

    async function loadAll() {
        try {
            const ks = ["ole:day-plan", "ole:todos", "ole:week-runs", "ole:w-ana", "ole:exams", "ole:grades", "ole:u-notes",
                "ole:sleep-log", "ole:weight-log", "ole:recovery-log", "ole:t-plan", "ole:flashcards", "ole:study-plans", "ole:max-hr"];
            const rs = await Promise.allSettled(ks.map(k => store.get(k)));
            const g = (i) => { try { return rs[i].value ? JSON.parse(rs[i].value.value) : null; } catch { return null; } };
            const p = g(0); if (p && p.day === new Date().toDateString()) { setPlan(p.p); setPlanBusy(false); } else genPlan();
            if (g(1)) setTodos(g(1)); if (g(2)) setWeekRuns(g(2)); if (g(3)) setWAna(g(3));
            if (g(4)) setExams(g(4)); if (g(5)) setGrades(g(5)); if (g(6)) setUNotes(g(6));
            if (g(7)) setSleepLog(g(7)); if (g(8)) setWeightLog(g(8)); if (g(9)) setRecoveryLog(g(9));
            if (g(10)) setTPlan(g(10)); if (g(11)) setFlashcards(g(11) || {}); if (g(12)) setStudyPlans(g(12) || {});
            if (g(13)) setMaxHR(g(13));
        } catch { genPlan(); }
        loadNutrition();
    }
    async function save(k, v) { try { await store.set(k, JSON.stringify(v)); } catch { } }

    async function genPlan() {
        setPlanBusy(true);
        if (!getKey()) { setPlanBusy(false); return; }
        const DN = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const td = DN[new Date().getDay()];
        const tc = DEF_COURSES.filter(c => c.days.includes(td));
        const ds = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
        const ex = exams.map(e => `${e.name} in ${dTo(e.date)} Tagen`).join(", ") || "keine";
        const cs = tc.length ? tc.map(c => `${c.name} ${c.time}`).join(", ") : "keine Vorlesungen";
        try {
            const raw = await callAI([{ role: "user", content: `Heute: ${ds}. Erstelle Oles Tagesplan.\nKurse: ${cs}\nKlausuren: ${ex}\nPost-OP Zone 1-2\nJSON only:\n{"summary":"string","warn":"string or null","blocks":[{"time":"HH:MM","type":"uni|sport|break","title":"string","note":"string or null"}]}` }], 600);
            const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
            setPlan(p); save("ole:day-plan", { day: new Date().toDateString(), p });
        } catch {
            setPlan({ summary: "Lernen + leichte Bewegung.", warn: "Post-OP: kein erhöhter Blutdruck.", blocks: [{ time: "08:00", type: "uni", title: tc[0]?.name || "Lernzeit", note: null }, { time: "14:30", type: "sport", title: "Zone 2 Lauf 40 min", note: "Puls unter 155" }] });
        }
        setPlanBusy(false);
    }

    async function loadNutrition() {
        if (!getKey()) return;
        const key = `ole:nut-${new Date().toDateString()}`;
        try { const c = await store.get(key); if (c) { setNutrition(JSON.parse(c.value)); return; } } catch { }
        setNutBusy(true);
        const day = new Date().getDay(), mi = day === 0 ? 6 : day - 1, isTd = WG[mi] > 0;
        try {
            const raw = await callAI([{ role: "user", content: `Ole 72kg Marathon Zone-2. Heute: ${isTd ? `Trainingstag (${WG[mi]} min)` : "Ruhetag"}.\nJSON only:\n{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"is_training":${isTd},"focus":"1 Satz","tip":"1 Tipp"}` }], 300);
            const n = JSON.parse(raw.replace(/```json|```/g, "").trim()); setNutrition(n); save(key, n);
        } catch {
            setNutrition(isTd ? { calories: 2900, protein_g: 140, carbs_g: 360, fat_g: 80, is_training: true, focus: "Kohlenhydrate vorladen.", tip: "Haferflocken 2h vor dem Run." } : { calories: 2400, protein_g: 130, carbs_g: 260, fat_g: 80, is_training: false, focus: "Regeneration.", tip: "Protein alle 3-4h." });
        }
        setNutBusy(false);
    }

    async function handleUpload(e) {
        const file = e.target.files[0]; if (!file) return;
        if (!getKey()) { setUpMsg("API Key nötig (Zahnrad oben)."); setTimeout(() => setUpMsg(""), 4000); return; }
        setUpBusy(true); setUpMsg("Wird analysiert...");
        try {
            const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
            const rsp = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": getKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 150, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: file.type || "image/png", data: b64 } }, { type: "text", text: "Apple Health workout screenshot. Extract date (YYYY-MM-DD) and duration in minutes. JSON only: {\"date\":\"YYYY-MM-DD\",\"duration_min\":number} or {\"error\":\"not found\"}" }] }] }) });
            const rd = await rsp.json();
            const txt = rd.content.filter(b => b.type === "text").map(b => b.text).join("");
            const result = JSON.parse(txt.replace(/```json|```/g, "").trim());
            if (result.error) { setUpMsg("Kein Workout gefunden."); }
            else { const up = { ...weekRuns, [result.date]: result.duration_min }; setWeekRuns(up); save("ole:week-runs", up); setUpMsg(`✓ ${result.date}: ${result.duration_min} min`); }
        } catch { setUpMsg("Fehler. Nochmal versuchen."); }
        setUpBusy(false); setTimeout(() => setUpMsg(""), 4000); e.target.value = "";
    }

    async function analyzeRun() {
        if (!dur && !dist) return;
        setWBusy(true); setWAna(null);
        const td = dk(new Date()), durN = parseInt(dur) || 0;
        if (durN > 0) { const up = { ...weekRuns, [td]: durN }; setWeekRuns(up); save("ole:week-runs", up); }
        const fl = feel !== null ? `${FEELINGS[feel]} (${feel + 1}/5)` : "–";
        const ds = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
        try {
            const raw = await callAI([{ role: "user", content: `Analysiere Oles Lauf. JSON only:\n{"verdict":"Sehr gut|Gut|Ok|Ausbaufähig","badge":"max 4 Wörter","summary":"2 Sätze","phase_fit":"1 Satz","recovery":"1 Satz","tip":"1 Tipp"}\n\nLaufen, ${ds}, ${dur || "–"} min, ${dist || "–"} km, Ø ${wHR || "–"} bpm, Gefühl: ${fl}${wNote ? `, ${wNote}` : ""}` }], 500);
            const a = JSON.parse(raw.replace(/```json|```/g, "").trim()); setWAna(a); save("ole:w-ana", a);
        } catch { setWAna({ verdict: "Gespeichert", badge: "erfasst", summary: "Lauf gespeichert.", phase_fit: "–", recovery: "–", tip: "–" }); }
        setWBusy(false);
    }

    async function genNote() {
        if (!nTop.trim()) return; setNBusy(true);
        try {
            const c = await callAI([{ role: "user", content: `Lernzusammenfassung für VWL-Student 2. Semester über: "${nTop}". Klar gegliedert, max 350 Wörter.` }], 600);
            const n = { id: Date.now(), topic: nTop, content: c, date: new Date().toLocaleDateString("de-DE") };
            const up = [n, ...uNotes].slice(0, 20); setUNotes(up); save("ole:u-notes", up); setNTop("");
        } catch { }
        setNBusy(false);
    }

    async function sendChat() {
        if (!chatTxt.trim() || chatBusy) return;
        const next = [...msgs, { role: "user", content: chatTxt }];
        setMsgs(next); setChatTxt(""); setChatBusy(true);
        try { const r = await callAI(next, 1000); setMsgs([...next, { role: "assistant", content: r }]); }
        catch { setMsgs([...next, { role: "assistant", content: getKey() ? "Verbindungsfehler." : "Bitte API Key eintragen (Zahnrad oben rechts)." }]); }
        setChatBusy(false);
    }

    function saveSleep() {
        if (!sleepH) return;
        const entry = { date: dk(new Date()), hours: parseFloat(sleepH), quality: sleepQ };
        const log = [entry, ...sleepLog.filter(x => x.date !== entry.date)].slice(0, 90);
        setSleepLog(log); save("ole:sleep-log", log);
        setSleepH(""); setSleepQ(null);
    }
    function saveWeight() {
        if (!wgInput) return;
        const entry = { date: dk(new Date()), weight: parseFloat(wgInput) };
        const log = [entry, ...weightLog.filter(x => x.date !== entry.date)].slice(0, 90);
        setWeightLog(log); save("ole:weight-log", log);
        setWgInput("");
    }
    function saveRecovery() {
        if (!rstHR) return;
        const lastSleep = sleepLog[0]?.hours ?? 7;
        const score = calcRecovery(parseFloat(rstHR), lastSleep, rstStress ?? 2);
        const entry = { date: dk(new Date()), restHR: parseFloat(rstHR), stress: rstStress, score };
        const log = [entry, ...recoveryLog.filter(x => x.date !== entry.date)].slice(0, 90);
        setRecoveryLog(log); save("ole:recovery-log", log);
        setRstHR(""); setRstStress(null);
    }
    async function genTrainingPlan() {
        if (!getKey()) return;
        setTPlanBusy(true);
        try {
            const raw = await callAI([{ role: "user", content: `Erstelle Oles Marathon-Trainingsplan für die nächsten 4 Wochen (${dTo("2026-10-11")} Tage bis München 11.10.2026). Wochenstruktur: Mo:40, Mi:55, Do:40, Sa:80, So:30 min. Zone-2 Fokus. Post-OP: Zone 1-2.\nJSON only:\n{"phase":"string","weeks":[{"week":1,"theme":"string","sessions":[{"day":"Mo|Di|Mi|Do|Fr|Sa|So","type":"string","minutes":number,"zone":"Z1|Z2|Z3|Tempo|Ruhe","note":"string"}]}]}` }], 1200);
            const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
            setTPlan(p); save("ole:t-plan", p);
        } catch { }
        setTPlanBusy(false);
    }
    async function genWeekReview() {
        if (!getKey()) return;
        setWrBusy(true);
        const dts = getWeekDates(); const acts = dts.map(d => weekRuns[dk(d)] || 0);
        const totA = acts.reduce((s, v) => s + v, 0);
        const slLast = sleepLog.slice(0, 7);
        const avgSl = slLast.length ? (slLast.reduce((s, e) => s + e.hours, 0) / slLast.length).toFixed(1) : "–";
        const exSoon = exams.map(e => `${e.name} in ${dTo(e.date)}d`).join(", ") || "keine";
        try {
            const raw = await callAI([{ role: "user", content: `Oles Wochenrückblick:\nTraining: ${totA}/${WG.reduce((s,v)=>s+v,0)} min\nSchlaf Ø: ${avgSl}h\nKlausuren: ${exSoon}\nGib kurzes Feedback (3-4 Sätze) und 2 Prioritäten für nächste Woche.` }], 400);
            setWeekReview(raw); save("ole:week-review", { date: dk(new Date()), text: raw });
        } catch { }
        setWrBusy(false);
    }
    async function genFlashcards(note) {
        if (!getKey() || !note) return;
        setFcBusy(true); setFcNoteId(note.id); setFcIdx(0); setFcFlipped(false);
        try {
            const raw = await callAI([{ role: "user", content: `Erstelle 8 prägnante Karteikarten für VWL-Student aus diesem Text:\n"${note.content}"\nJSON only:\n[{"q":"Frage","a":"Antwort"}]` }], 800);
            const cards = JSON.parse(raw.replace(/```json|```/g, "").trim());
            const updated = { ...flashcards, [note.id]: cards };
            setFlashcards(updated); save("ole:flashcards", updated);
        } catch { }
        setFcBusy(false);
    }
    async function genStudyPlan(exam) {
        if (!getKey()) return;
        setSpBusy(exam.id);
        try {
            const d = dTo(exam.date);
            const raw = await callAI([{ role: "user", content: `Erstelle einen strukturierten Lernplan für VWL-Student für "${exam.name}" in ${d} Tagen. JSON only:\n{"phases":[{"name":"string","days":"string","goal":"string","topics":["string"]}]}` }], 600);
            const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
            const updated = { ...studyPlans, [exam.id]: p };
            setStudyPlans(updated); save("ole:study-plans", updated);
        } catch { }
        setSpBusy(null);
    }

    const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    const dLeft = dTo("2026-10-11"), wLeft = Math.floor(dLeft / 7);
    const canRun = (dur || dist) && !wBusy;
    const vClr = v => !v ? "var(--color-text-secondary)" : v.includes("Sehr") ? "#2ecc71" : v.includes("Gut") ? SP.acc : v.includes("Aus") ? "#c026d3" : "var(--color-text-secondary)";
    const weekDts = getWeekDates(), actuals = weekDts.map(d => weekRuns[dk(d)] || 0);
    const totGoal = WG.reduce((s, v) => s + v, 0), totAct = actuals.reduce((s, v) => s + v, 0);
    const maxBar = Math.max(...WG, ...actuals, 10);
    const tdKey = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date().getDay()];
    const tEcts = grades.reduce((s, g) => s + parseInt(g.ects || 0), 0);
    const ns = grades.length ? (grades.reduce((s, g) => s + parseFloat(g.grade || 0) * parseInt(g.ects || 0), 0) / tEcts).toFixed(2) : null;
    const pR = 54, pC = 2 * Math.PI * pR, pTot = pomBreak ? 5 * 60 : 25 * 60, pOff = pC * (1 - (pTot - pomSecs) / pTot);
    const nutTot = nutrition ? nutrition.protein_g * 4 + nutrition.carbs_g * 4 + nutrition.fat_g * 9 : 1;
    const pPct = nutrition ? Math.round(nutrition.protein_g * 4 / nutTot * 100) : 21;
    const cPct = nutrition ? Math.round(nutrition.carbs_g * 4 / nutTot * 100) : 53;
    const fPct = 100 - pPct - cPct;
    const SW = 440, SH = 170, ML = 36, MT = 14, MR = 8, MB = 28, cW = SW - ML - MR, cH = SH - MT - MB, gW = cW / 7, bW = Math.min(16, gW * 0.27), bGap = 4, sY = cH / maxBar;

    return (
        <div style={{
            fontFamily: "var(--font-sans)",
            color: "var(--color-text-primary)",
            background: tokens.colors.bg.base,
            minHeight: "100vh",
            display: "flex",
        }}>
            <Sidebar
                activeTab={tab}
                onTabChange={(id) => id === "settings" ? setShowSettings(true) : setTab(id)}
            />
            <main style={{
                flex: 1,
                minWidth: 0,
                maxHeight: "100vh",
                overflowY: "auto",
                padding: "0 16px 20px",
            }}>
                <div className="titlebar" />

            {/* SETTINGS OVERLAY */}
            {showSettings && (
                <div onClick={() => setShowSettings(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-primary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem", width: 340, maxWidth: "90%" }}>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Anthropic API Key</p>
                        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>Damit die KI-Features funktionieren. Bekommst du auf console.anthropic.com</p>
                        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..." style={{ ...INP, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Max-Herzfrequenz <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>bpm</span></p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Für die Puls-Zonen-Berechnung. Faustregel: 220 − Alter.</p>
                        <input type="number" value={maxHR} onChange={e => setMaxHR(parseInt(e.target.value) || 197)} onBlur={() => save("ole:max-hr", maxHR)} style={{ ...INP, marginBottom: 12 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveKey} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 700, fontSize: 13, border: "none", background: "linear-gradient(135deg,#c026d3,#6366f1)", color: "#ffffff" }}>Speichern</button>
                            <button onClick={() => setShowSettings(false)} style={{ padding: "10px 16px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontSize: 13, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}>Abbrechen</button>
                        </div>
                    </div>
                </div>
            )}

            {/* API KEY BANNER */}
            {!keySet && (
                <div onClick={() => setShowSettings(true)} style={{ cursor: "pointer", fontSize: 12, background: "rgba(192,38,211,0.1)", color: "#c026d3", padding: "10px 13px", borderRadius: "var(--border-radius-md)", marginBottom: 16, border: "0.5px solid rgba(192,38,211,0.25)", lineHeight: 1.5 }}>
                    ⚙ KI-Features sind noch aus. Tippe hier um deinen API Key einzutragen.
                </div>
            )}

            {/* ── DASHBOARD ── */}
            {tab === "dash" && <Dashboard />}

            {/* ── HEALTH ── */}
            {tab === "health" && <Health />}

            {/* ── TRAINING PLAN ── */}
            {tab === "plan" && <TrainingPlan />}

            {/* ── WORKOUT ── */}
            {tab === "workout" && (
                <div>
                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div><p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px" }}>Wochenvolumen</p><p style={{ fontSize: 12, margin: 0 }}><span style={{ color: SP.acc, fontWeight: 700 }}>{totAct} min</span><span style={{ color: "var(--color-text-tertiary)" }}> / {totGoal} min</span></p></div>
                            <label style={{ cursor: "pointer" }}><input type="file" accept="image/*" onChange={handleUpload} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} /><div style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20, background: SP.bg, color: SP.acc, border: `0.5px solid ${SP.br}`, cursor: "pointer", whiteSpace: "nowrap" }}>{upBusy ? "..." : "📷 Screenshot"}</div></label>
                        </div>
                        {upMsg && <p style={{ fontSize: 11, color: upMsg.startsWith("✓") ? "#2ecc71" : "#ff7675", margin: "0 0 6px", fontWeight: 500 }}>{upMsg}</p>}
                        <svg width="100%" viewBox={`0 0 ${SW} ${SH}`} style={{ overflow: "visible" }}>
                            {[0, 0.5, 1].map((f, i) => { const v = Math.round(maxBar * f), y = MT + cH - v * sY; return (<g key={i}><line x1={ML} y1={y} x2={SW - MR} y2={y} stroke="rgba(128,128,128,0.1)" strokeWidth="1" strokeDasharray="3 3" /><text x={ML - 4} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(128,128,128,0.45)">{v}</text></g>); })}
                            {DL.map((day, i) => {
                                const isT = weekDts[i].toDateString() === new Date().toDateString(); const cx = ML + i * gW + gW / 2, gX = cx - bW - bGap / 2, aX = cx + bGap / 2, goal = WG[i], actual = actuals[i], gH = goal * sY, aH = actual * sY, bY = MT + cH; return (
                                    <g key={day}>
                                        {goal > 0 && <rect x={gX} y={bY - gH} width={bW} height={gH} rx="3" fill={GBL} fillOpacity={isT ? 1 : 0.6} stroke="#6366f1" strokeWidth="0.5" />}
                                        {actual > 0 && <rect x={aX} y={bY - aH} width={bW} height={aH} rx="3" fill={SP.acc} fillOpacity={isT ? 1 : 0.75} />}
                                        {goal === 0 && <line x1={cx - 8} y1={bY - 1} x2={cx + 8} y2={bY - 1} stroke="rgba(128,128,128,0.2)" strokeWidth="2" strokeLinecap="round" />}
                                        <text x={cx} y={SH - 5} textAnchor="middle" fontSize="11" fill={isT ? SP.acc : "rgba(128,128,128,0.55)"} fontWeight={isT ? "700" : "400"}>{day}</text>
                                        {isT && <circle cx={cx} cy={SH - 20} r="2.5" fill={SP.acc} />}
                                    </g>
                                );
                            })}
                            <line x1={ML} y1={MT + cH} x2={SW - MR} y2={MT + cH} stroke="rgba(128,128,128,0.15)" strokeWidth="1" />
                        </svg>
                        <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", marginTop: 4 }}>
                            {[[GBL, "Ziel"], [SP.acc, "Aktuell"]].map(([c, l]) => (<div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-tertiary)" }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}</div>))}
                        </div>
                    </div>

                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Ernährung heute</p>
                            {nutrition && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: nutrition.is_training ? SP.bg : "rgba(128,128,128,0.08)", color: nutrition.is_training ? SP.acc : "var(--color-text-tertiary)", border: `0.5px solid ${nutrition.is_training ? SP.br : "rgba(128,128,128,0.15)"}` }}>{nutrition.is_training ? "Trainingstag" : "Ruhetag"}</span>}
                        </div>
                        {nutBusy ? <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>KI berechnet Makros...</p> : nutrition ? (
                            <div>
                                <p style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-1px", ...gTxt("#c026d3", "#6366f1") }}>{nutrition.calories}<span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0 }}> kcal</span></p>
                                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                    {[{ l: "Protein", v: nutrition.protein_g, c: "#c026d3", bg: "rgba(192,38,211,0.1)" }, { l: "Carbs", v: nutrition.carbs_g, c: "#6366f1", bg: "rgba(99,102,241,0.1)" }, { l: "Fett", v: nutrition.fat_g, c: "#a855f7", bg: "rgba(168,85,247,0.1)" }].map(m => (<div key={m.l} style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--border-radius-md)", background: m.bg, textAlign: "center" }}><p style={{ fontSize: 18, fontWeight: 800, margin: 0, color: m.c, fontVariantNumeric: "tabular-nums" }}>{m.v}<span style={{ fontSize: 11, fontWeight: 600 }}>g</span></p><p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "2px 0 0", fontWeight: 600, textTransform: "uppercase" }}>{m.l}</p></div>))}
                                </div>
                                <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}><div style={{ width: `${pPct}%`, background: "#c026d3" }} /><div style={{ width: `${cPct}%`, background: "#6366f1" }} /><div style={{ width: `${fPct}%`, background: "#a855f7" }} /></div>
                                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 3px", lineHeight: 1.5 }}>{nutrition.focus}</p>
                                <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>💡 {nutrition.tip}</p>
                            </div>
                        ) : <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>API Key eintragen für Makro-Empfehlungen.</p>}
                    </div>

                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>🏃 Lauf erfassen</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div><p style={LBL}>Dauer <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>min</span></p><input type="number" value={dur} onChange={e => setDur(e.target.value)} placeholder="52" style={BINP} /></div>
                            <div><p style={LBL}>Distanz <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>km</span></p><input type="number" value={dist} onChange={e => setDist(e.target.value)} placeholder="9.8" style={BINP} /></div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <p style={LBL}>Ø Herzfrequenz <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>bpm</span></p>
                            <input type="number" value={wHR} onChange={e => setWHR(e.target.value)} placeholder="148" style={BINP} />
                            {wHR && (() => { const z = getZone(parseInt(wHR), maxHR); return (
                                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: "var(--border-radius-md)", background: `${z.color}15`, border: `0.5px solid ${z.color}40`, display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: z.color }}>{z.name}</span>
                                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flex: 1 }}>{z.desc}</span>
                                    <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{Math.round(parseInt(wHR) / maxHR * 100)}% von {maxHR}</span>
                                </div>
                            ); })()}
                        </div>
                        <p style={LBL}>Wie war's?</p>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{FEELINGS.map((em, i) => <button key={i} onClick={() => setFeel(feel === i ? null : i)} style={{ flex: 1, fontSize: 26, padding: "10px 0", borderRadius: "var(--border-radius-md)", cursor: "pointer", lineHeight: 1, background: feel === i ? SP.bg : "var(--color-background-secondary)", border: feel === i ? `0.5px solid ${SP.acc}` : "0.5px solid transparent" }}>{em}</button>)}</div>
                        <div style={{ marginBottom: 16 }}><p style={LBL}>Notiz <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p><textarea value={wNote} onChange={e => setWNote(e.target.value)} placeholder="Beine schwer, Schlaf 7h..." style={{ ...INP, minHeight: 56, resize: "none", lineHeight: 1.5 }} /></div>
                        <button onClick={analyzeRun} disabled={!canRun} style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: canRun ? "pointer" : "default", border: "none", background: canRun ? "linear-gradient(135deg,#6366f1,#c026d3)" : "var(--color-background-secondary)", color: canRun ? "#ffffff" : "var(--color-text-tertiary)" }}>{wBusy ? "Claude analysiert..." : "Lauf analysieren →"}</button>
                        {wAna && (
                            <div style={{ marginTop: 16, padding: "1rem", borderRadius: "var(--border-radius-lg)", background: "var(--color-background-secondary)", border: `0.5px solid ${SP.br}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><p style={{ fontSize: 17, fontWeight: 700, margin: 0, color: vClr(wAna.verdict) }}>{wAna.verdict}</p><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: SP.bg, color: SP.acc, border: `0.5px solid ${SP.br}` }}>{wAna.badge}</span></div>
                                <p style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 10px", color: "var(--color-text-secondary)" }}>{wAna.summary}</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{[["Phase", wAna.phase_fit], ["Erholung", wAna.recovery], ["Tipp", wAna.tip]].map(([l, v]) => { if (!v || v === "–") return null; return <div key={l} style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-md)", padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}><span style={{ fontSize: 10, fontWeight: 700, color: SP.acc, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, marginTop: 2 }}>{l}</span><span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{v}</span></div>; })}</div>
                                <button onClick={() => { setWAna(null); setDur(""); setDist(""); setWHR(""); setFeel(null); setWNote(""); }} style={{ fontSize: 12, color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 10 }}>Neuen Lauf erfassen →</button>
                            </div>
                        )}
                    </div>

                    {/* ── TRAININGSPLAN ── */}
                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginTop: "1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📋 Trainingsplan</p>
                            <button onClick={genTrainingPlan} disabled={tPlanBusy || !keySet} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20, background: keySet ? SP.bg : "var(--color-background-secondary)", color: keySet ? SP.acc : "var(--color-text-tertiary)", border: `0.5px solid ${keySet ? SP.br : "transparent"}`, cursor: keySet ? "pointer" : "default" }}>{tPlanBusy ? "..." : tPlan ? "↺ Neu generieren" : "✨ KI-Plan erstellen"}</button>
                        </div>
                        {!tPlan && (
                            <div>
                                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>Aktuelle Standard-Wochenstruktur:</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {DL.map((day, i) => {
                                        const min = WG[i]; const isRest = min === 0;
                                        const isLong = min >= 80; const zoneName = isRest ? "Ruhe" : isLong ? "Zone 2 Long" : "Zone 2";
                                        const zoneClr = isRest ? "#999" : isLong ? "#6366f1" : "#818cf8";
                                        return (
                                            <div key={day} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: SP.acc, minWidth: 24 }}>{day}</span>
                                                <span style={{ flex: 1, fontSize: 13, color: isRest ? "var(--color-text-tertiary)" : "var(--color-text-primary)" }}>{isRest ? "Ruhetag" : `${min} min ${zoneName}`}</span>
                                                {!isRest && <span style={{ fontSize: 10, fontWeight: 700, color: zoneClr, padding: "1px 7px", borderRadius: 10, border: `0.5px solid ${zoneClr}40` }}>{zoneName}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                {!keySet && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "10px 0 0", fontStyle: "italic" }}>Mit API Key generiert die KI einen personalisierten 4-Wochen-Plan.</p>}
                            </div>
                        )}
                        {tPlan && (
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 700, color: SP.acc, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{tPlan.phase || "Trainingsphase"}</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {tPlan.weeks && tPlan.weeks.map((w, wi) => (
                                        <div key={wi} style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: `0.5px solid ${SP.br}` }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px", color: SP.acc }}>Woche {w.week}: {w.theme}</p>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                                {w.sessions && w.sessions.map((s, si) => (
                                                    <div key={si} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
                                                        <span style={{ fontWeight: 700, color: SP.acc, minWidth: 22 }}>{s.day}</span>
                                                        <span style={{ flex: 1 }}>{s.type} · {s.minutes} min</span>
                                                        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{s.zone}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── STRAVA (Platzhalter) ── */}
                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginTop: "1.25rem" }}>
                        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>🔗 Strava-Verbindung</p>
                        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>Automatischer Import deiner Aktivitäten. Strava-Anbindung benötigt OAuth-Setup (eigene App auf strava.com/settings/api). Kommt in nächster Iteration.</p>
                    </div>
                </div>
            )}

            {/* ── BODY ── */}
            {tab === "body" && (
                <div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                        {[["schlaf", "😴 Schlaf"], ["gewicht", "⚖️ Gewicht"], ["erholung", "💚 Erholung"], ["zonen", "❤️ Zonen"]].map(([k, l]) => (
                            <button key={k} onClick={() => setBodyTab(k)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: bodyTab === k ? BD.bg : "var(--color-background-secondary)", border: bodyTab === k ? `0.5px solid ${BD.acc}` : "0.5px solid transparent", color: bodyTab === k ? BD.acc : "var(--color-text-secondary)", fontWeight: bodyTab === k ? 700 : 400 }}>{l}</button>
                        ))}
                    </div>

                    {bodyTab === "schlaf" && (
                        <div>
                            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Letzte 7 Tage</p>
                                <svg width="100%" viewBox="0 0 440 170" style={{ overflow: "visible" }}>
                                    {[0, 4, 8].map((v, i) => { const y = 14 + 128 - v * 16; return (<g key={i}><line x1={36} y1={y} x2={432} y2={y} stroke="rgba(128,128,128,0.1)" strokeDasharray="3 3" /><text x={32} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(128,128,128,0.45)">{v}h</text></g>); })}
                                    {DL.map((day, i) => {
                                        const d = weekDts[i]; const ent = sleepLog.find(s => s.date === dk(d));
                                        const hrs = ent?.hours ?? 0; const isT = d.toDateString() === new Date().toDateString();
                                        const cx = 36 + i * (396 / 7) + (396 / 14); const bH = hrs * 16;
                                        const optimal = hrs >= 7 && hrs <= 9; const clr = optimal ? BD.acc : hrs >= 6 ? "#6366f1" : "#d63031";
                                        return (
                                            <g key={day}>
                                                {hrs > 0 && <rect x={cx - 12} y={142 - bH} width={24} height={bH} rx="3" fill={clr} fillOpacity={isT ? 1 : 0.6} />}
                                                {ent?.quality !== null && ent?.quality !== undefined && <text x={cx} y={138 - bH} textAnchor="middle" fontSize="13">{SLEEP_QUAL[ent.quality]}</text>}
                                                <text x={cx} y={165} textAnchor="middle" fontSize="11" fill={isT ? BD.acc : "rgba(128,128,128,0.55)"} fontWeight={isT ? "700" : "400"}>{day}</text>
                                            </g>
                                        );
                                    })}
                                    <line x1={36} y1={142} x2={432} y2={142} stroke="rgba(128,128,128,0.15)" />
                                </svg>
                            </div>
                            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Schlaf von heute Nacht</p>
                                <div style={{ marginBottom: 14 }}>
                                    <p style={LBL}>Stunden</p>
                                    <input type="number" step="0.5" value={sleepH} onChange={e => setSleepH(e.target.value)} placeholder="7.5" style={BINP} />
                                </div>
                                <p style={LBL}>Qualität</p>
                                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                    {SLEEP_QUAL.map((em, i) => <button key={i} onClick={() => setSleepQ(sleepQ === i ? null : i)} style={{ flex: 1, fontSize: 24, padding: "10px 0", borderRadius: "var(--border-radius-md)", cursor: "pointer", lineHeight: 1, background: sleepQ === i ? BD.bg : "var(--color-background-secondary)", border: sleepQ === i ? `0.5px solid ${BD.acc}` : "0.5px solid transparent" }}>{em}</button>)}
                                </div>
                                <button onClick={saveSleep} disabled={!sleepH} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: sleepH ? "pointer" : "default", border: "none", background: sleepH ? `linear-gradient(135deg,#6366f1,#818cf8)` : "var(--color-background-secondary)", color: sleepH ? "#ffffff" : "var(--color-text-tertiary)" }}>Speichern</button>
                            </div>
                        </div>
                    )}

                    {bodyTab === "gewicht" && (() => {
                        const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
                        const minW = sorted.length ? Math.min(...sorted.map(e => e.weight)) - 1 : 70;
                        const maxW = sorted.length ? Math.max(...sorted.map(e => e.weight)) + 1 : 75;
                        const rng = Math.max(1, maxW - minW);
                        const cur = weightLog[0]?.weight ?? null;
                        const trend = weightLog.length >= 2 ? (weightLog[0].weight - weightLog[Math.min(6, weightLog.length - 1)].weight).toFixed(1) : null;
                        return (
                            <div>
                                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                                        <div>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Aktuell</p>
                                            <p style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-1.5px", ...gTxt("#6366f1", "#818cf8") }}>{cur ?? "–"}<span style={{ fontSize: 14, fontWeight: 600 }}> kg</span></p>
                                        </div>
                                        {trend !== null && <div style={{ textAlign: "right" }}>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Trend 7d</p>
                                            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: parseFloat(trend) > 0 ? "#c026d3" : BD.acc }}>{trend > 0 ? "+" : ""}{trend} kg</p>
                                        </div>}
                                    </div>
                                    {sorted.length > 1 && (
                                        <svg width="100%" viewBox="0 0 440 130" style={{ overflow: "visible" }}>
                                            <polyline points={sorted.map((e, i) => `${20 + i * (400 / (sorted.length - 1))},${110 - (e.weight - minW) / rng * 90}`).join(" ")} fill="none" stroke={BD.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            {sorted.map((e, i) => (<circle key={i} cx={20 + i * (400 / (sorted.length - 1))} cy={110 - (e.weight - minW) / rng * 90} r="3" fill={BD.acc} />))}
                                            <text x={4} y={20} fontSize="10" fill="rgba(128,128,128,0.55)">{maxW.toFixed(1)}</text>
                                            <text x={4} y={114} fontSize="10" fill="rgba(128,128,128,0.55)">{minW.toFixed(1)}</text>
                                        </svg>
                                    )}
                                    {sorted.length <= 1 && <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0, textAlign: "center", padding: 20 }}>Logge mehrere Werte um den Trend zu sehen.</p>}
                                </div>
                                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                                    <p style={LBL}>Heutiges Gewicht (kg)</p>
                                    <input type="number" step="0.1" value={wgInput} onChange={e => setWgInput(e.target.value)} placeholder="72.3" style={{ ...BINP, marginBottom: 14 }} />
                                    <button onClick={saveWeight} disabled={!wgInput} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: wgInput ? "pointer" : "default", border: "none", background: wgInput ? `linear-gradient(135deg,#6366f1,#818cf8)` : "var(--color-background-secondary)", color: wgInput ? "#ffffff" : "var(--color-text-tertiary)" }}>Speichern</button>
                                </div>
                            </div>
                        );
                    })()}

                    {bodyTab === "erholung" && (() => {
                        const today = recoveryLog[0];
                        return (
                            <div>
                                {today && (
                                    <div style={{ background: `linear-gradient(135deg,${BD.bg},rgba(99,102,241,0.06))`, border: `0.5px solid ${BD.br}`, borderRadius: "var(--border-radius-lg)", padding: "1.25rem", marginBottom: "1.25rem", textAlign: "center" }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: BD.acc, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>Recovery Score</p>
                                        <p style={{ fontSize: 56, fontWeight: 800, margin: 0, letterSpacing: "-2.5px", ...gTxt("#6366f1", "#818cf8") }}>{today.score}<span style={{ fontSize: 16, fontWeight: 600 }}>/10</span></p>
                                        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "8px 0 0" }}>Ruhe-HF {today.restHR} bpm · {today.stress !== null ? STRESS_LVL[today.stress] : "–"}</p>
                                    </div>
                                )}
                                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                                    <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Morgen-Check-in</p>
                                    <div style={{ marginBottom: 14 }}>
                                        <p style={LBL}>Ruhe-Herzfrequenz <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>bpm, direkt nach dem Aufwachen</span></p>
                                        <input type="number" value={rstHR} onChange={e => setRstHR(e.target.value)} placeholder="48" style={BINP} />
                                    </div>
                                    <p style={LBL}>Stress-Level</p>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                        {STRESS_LVL.map((em, i) => <button key={i} onClick={() => setRstStress(rstStress === i ? null : i)} style={{ flex: 1, fontSize: 22, padding: "10px 0", borderRadius: "var(--border-radius-md)", cursor: "pointer", lineHeight: 1, background: rstStress === i ? BD.bg : "var(--color-background-secondary)", border: rstStress === i ? `0.5px solid ${BD.acc}` : "0.5px solid transparent" }}>{em}</button>)}
                                    </div>
                                    <button onClick={saveRecovery} disabled={!rstHR} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: rstHR ? "pointer" : "default", border: "none", background: rstHR ? `linear-gradient(135deg,#6366f1,#818cf8)` : "var(--color-background-secondary)", color: rstHR ? "#ffffff" : "var(--color-text-tertiary)" }}>Recovery berechnen</button>
                                </div>
                                {recoveryLog.length > 1 && (
                                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginTop: "1.25rem" }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Letzte Werte</p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            {recoveryLog.slice(0, 7).map((r, i) => (
                                                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, padding: "6px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}>
                                                    <span style={{ color: "var(--color-text-tertiary)", minWidth: 80 }}>{r.date}</span>
                                                    <span style={{ flex: 1, color: "var(--color-text-secondary)" }}>{r.restHR} bpm</span>
                                                    <span style={{ fontWeight: 700, color: r.score >= 7 ? BD.acc : r.score >= 5 ? "#6366f1" : "#d63031" }}>{r.score}/10</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {bodyTab === "zonen" && (
                        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Puls-Zonen</p>
                                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>HFmax = {maxHR} bpm</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {[[1, 0, 60, "Aktive Erholung", "Sehr leicht, locker"], [2, 60, 70, "Aerob / Fettverbrennung", "Komfortabel, Unterhaltung möglich"], [3, 70, 80, "Aerob-Anaerob Mix", "Spürbar, kontrolliert anstrengend"], [4, 80, 90, "Threshold", "Hart, kaum sprechen"], [5, 90, 100, "VO2max / Maximal", "Maximal, nur kurze Intervalle"]].map(([z, lo, hi, name, desc]) => {
                                    const loB = Math.round(maxHR * lo / 100); const hiB = Math.round(maxHR * hi / 100);
                                    const clr = z === 1 ? "#818cf8" : z === 2 ? "#6366f1" : z === 3 ? "#6366f1" : z === 4 ? "#c026d3" : "#d63031";
                                    return (
                                        <div key={z} style={{ padding: "10px 12px", borderRadius: "var(--border-radius-md)", background: `${clr}15`, border: `0.5px solid ${clr}40` }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                                                <span style={{ fontSize: 13, fontWeight: 800, color: clr }}>Zone {z}: {name}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: clr, fontVariantNumeric: "tabular-nums" }}>{loB}–{hiB} bpm</span>
                                            </div>
                                            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{desc} · {lo}–{hi}% HFmax</p>
                                        </div>
                                    );
                                })}
                            </div>
                            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "12px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>HFmax über Einstellungen (⚙) anpassen. Marathon-Tempo läuft typischerweise in Zone 2–3.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── UNI ── */}
            {tab === "uni" && (
                <div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
                        {[["pruefungen", "🎯 Prüfungen"], ["vorbereitung", "📋 Lernplan"], ["pomodoro", "⏱ Pomodoro"], ["kurse", "📚 Kurse"], ["noten", "🏅 Noten"], ["notizen", "✨ Notizen"], ["karten", "🃏 Karten"]].map(([k, l]) => (<button key={k} onClick={() => setUTab(k)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: uTab === k ? UN.bg : "var(--color-background-secondary)", border: uTab === k ? `0.5px solid ${UN.acc}` : "0.5px solid transparent", color: uTab === k ? UN.acc : "var(--color-text-secondary)", fontWeight: uTab === k ? 700 : 400 }}>{l}</button>))}
                    </div>
                    {uTab === "pruefungen" && (
                        <div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                {[...exams].sort((a, b) => new Date(a.date) - new Date(b.date)).map(ex => {
                                    const d = dTo(ex.date), urg = d <= 14, c = urg ? { acc: "#c026d3", br: "rgba(192,38,211,0.3)", bg: "rgba(192,38,211,0.08)" } : UN; return (
                                        <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: c.bg, border: `0.5px solid ${c.br}` }}>
                                            <div style={{ textAlign: "center", minWidth: 46 }}><p style={{ fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-1.5px", ...gTxt(c.acc, urg ? "#6366f1" : "#6366f1") }}>{d}</p><p style={{ fontSize: 9, color: "var(--color-text-tertiary)", margin: 0, fontWeight: 700 }}>TAGE</p></div>
                                            <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px" }}>{ex.name}</p><p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{new Date(ex.date).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}</p></div>
                                            <button onClick={() => { const e = exams.filter(x => x.id !== ex.id); setExams(e); save("ole:exams", e); }} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: "4px" }}>×</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input value={exName} onChange={e => setExName(e.target.value)} placeholder="Prüfungsname" style={{ ...INP, flex: 2, minWidth: 120 }} />
                                <input type="date" value={exDate} onChange={e => setExDate(e.target.value)} style={{ ...INP, flex: 1, minWidth: 120 }} />
                                <button onClick={() => { if (!exName || !exDate) return; const e = [...exams, { id: Date.now(), name: exName, date: exDate }]; setExams(e); save("ole:exams", e); setExName(""); setExDate(""); }} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: UN.bg, color: UN.acc, border: `0.5px solid ${UN.br}`, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>+ Hinzufügen</button>
                            </div>
                        </div>
                    )}
                    {uTab === "pomodoro" && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, paddingTop: 8 }}>
                            <div style={{ position: "relative", width: 148, height: 148 }}>
                                <svg width="148" height="148" viewBox="0 0 148 148"><circle cx="74" cy="74" r={pR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" /><circle cx="74" cy="74" r={pR} fill="none" stroke={pomBreak ? "#6366f1" : SP.acc} strokeWidth="9" strokeLinecap="round" strokeDasharray={pC} strokeDashoffset={pOff} transform="rotate(-90 74 74)" style={{ transition: "stroke-dashoffset 0.5s ease" }} /></svg>
                                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><p style={{ fontSize: 30, fontWeight: 800, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-1px", ...gTxt(pomBreak ? "#6366f1" : "#6366f1", pomBreak ? "#818cf8" : "#c026d3") }}>{fmtT(pomSecs)}</p><p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.12em" }}>{pomBreak ? "PAUSE" : "FOKUS"}</p></div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><select value={pomSubj} onChange={e => setPomSubj(e.target.value)} style={{ ...INP, width: "auto", fontSize: 13 }}>{DEF_COURSES.map(c => <option key={c.id}>{c.short}</option>)}</select><span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{pomCount} heute</span></div>
                            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setPomRun(r => !r)} style={{ padding: "11px 32px", borderRadius: "var(--border-radius-lg)", cursor: "pointer", fontWeight: 700, fontSize: 15, border: "none", background: pomRun ? "var(--color-background-secondary)" : "linear-gradient(135deg,#6366f1,#c026d3)", color: pomRun ? "var(--color-text-secondary)" : "#ffffff" }}>{pomRun ? "Pause ⏸" : "Start ▶"}</button><button onClick={() => { setPomRun(false); setPomSecs(25 * 60); setPomBreak(false); }} style={{ padding: "11px 20px", borderRadius: "var(--border-radius-lg)", cursor: "pointer", fontSize: 14, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}>Reset</button></div>
                        </div>
                    )}
                    {uTab === "kurse" && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{DEF_COURSES.map(c => { const isT = c.days.includes(tdKey); return (<div key={c.id} style={{ padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: isT ? UN.bg : "var(--color-background-secondary)", border: `0.5px solid ${isT ? UN.acc : "transparent"}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 3px", color: isT ? UN.acc : "var(--color-text-primary)" }}>{c.name}</p><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{c.days.join(" · ")} · {c.time} · {c.room}</p></div><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: UN.bg, color: UN.acc, border: `0.5px solid ${UN.br}`, flexShrink: 0, marginLeft: 8 }}>{c.ects} ECTS</span></div>{isT && <p style={{ fontSize: 11, color: UN.acc, margin: "6px 0 0", fontWeight: 700 }}>↑ Heute</p>}</div>); })}</div>)}
                    {uTab === "noten" && (
                        <div>
                            {ns && <div style={{ padding: "16px", borderRadius: "var(--border-radius-lg)", background: `linear-gradient(135deg,${UN.bg},rgba(99,102,241,0.08))`, border: `0.5px solid ${UN.br}`, marginBottom: 16, textAlign: "center" }}><p style={{ fontSize: 11, fontWeight: 700, color: UN.acc, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Notenschnitt</p><p style={{ fontSize: 42, fontWeight: 800, margin: 0, letterSpacing: "-2px", ...gTxt("#c026d3", "#6366f1") }}>{ns}</p><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>{tEcts} ECTS</p></div>}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>{grades.map((g, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}><span style={{ flex: 1, fontSize: 13 }}>{g.course}</span><span style={{ fontSize: 18, fontWeight: 800, color: UN.acc, fontVariantNumeric: "tabular-nums" }}>{g.grade}</span><span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{g.ects} ECTS</span><button onClick={() => { const g2 = grades.filter((_, j) => j !== i); setGrades(g2); save("ole:grades", g2); }} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>×</button></div>))}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={gCrs} onChange={e => setGCrs(e.target.value)} placeholder="Fach" style={{ ...INP, flex: 2, minWidth: 100 }} /><input type="number" step="0.1" value={gVal} onChange={e => setGVal(e.target.value)} placeholder="1.7" style={{ ...INP, flex: 1, minWidth: 60 }} /><input type="number" value={gEcts} onChange={e => setGEcts(e.target.value)} placeholder="ECTS" style={{ ...INP, flex: 1, minWidth: 60 }} /><button onClick={() => { if (!gCrs || !gVal) return; const g2 = [...grades, { course: gCrs, grade: gVal, ects: gEcts || 6 }]; setGrades(g2); save("ole:grades", g2); setGCrs(""); setGVal(""); setGEcts(""); }} style={{ padding: "9px 14px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: UN.bg, color: UN.acc, border: `0.5px solid ${UN.br}`, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>+ Note</button></div>
                        </div>
                    )}
                    {uTab === "notizen" && (
                        <div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input value={nTop} onChange={e => setNTop(e.target.value)} onKeyDown={e => { if (e.key === "Enter") genNote(); }} placeholder="Thema, z.B. Preiselastizität..." style={{ ...INP, flex: 1 }} /><button onClick={genNote} disabled={!nTop.trim() || nBusy} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: "linear-gradient(135deg,#c026d3,#6366f1)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, flexShrink: 0, opacity: nTop.trim() && !nBusy ? 1 : 0.5 }}>{nBusy ? "..." : "✨ Erstellen"}</button></div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{uNotes.map(n => (<div key={n.id} style={{ padding: "12px 14px", borderRadius: "var(--border-radius-lg)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><p style={{ fontSize: 14, fontWeight: 700, margin: 0, ...gTxt("#c026d3", "#6366f1") }}>{n.topic}</p><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{n.date}</span><button onClick={() => { const up = uNotes.filter(x => x.id !== n.id); setUNotes(up); save("ole:u-notes", up); }} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>×</button></div></div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.content}</p></div>))}{uNotes.length === 0 && !nBusy && <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Gib ein Thema ein für eine KI-Zusammenfassung.</p>}</div>
                        </div>
                    )}
                    {uTab === "vorbereitung" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[...exams].sort((a, b) => new Date(a.date) - new Date(b.date)).map(ex => {
                                const d = dTo(ex.date); const sp = studyPlans[ex.id];
                                return (
                                    <div key={ex.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div><p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px", ...gTxt("#c026d3", "#6366f1") }}>{ex.name}</p><p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>{d} Tage</p></div>
                                            <button onClick={() => genStudyPlan(ex)} disabled={spBusy === ex.id || !keySet} style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 20, background: keySet ? UN.bg : "var(--color-background-secondary)", color: keySet ? UN.acc : "var(--color-text-tertiary)", border: `0.5px solid ${keySet ? UN.br : "transparent"}`, cursor: keySet ? "pointer" : "default" }}>{spBusy === ex.id ? "..." : sp ? "↺ Neu" : "✨ Plan"}</button>
                                        </div>
                                        {sp && sp.phases && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                {sp.phases.map((ph, pi) => (
                                                    <div key={pi} style={{ padding: "9px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: UN.acc }}>{ph.name}</span>
                                                            <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{ph.days}</span>
                                                        </div>
                                                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{ph.goal}</p>
                                                        {ph.topics && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>{ph.topics.join(" · ")}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!sp && !keySet && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0, fontStyle: "italic" }}>API Key für KI-Lernplan nötig.</p>}
                                        {!sp && keySet && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0, fontStyle: "italic" }}>Klick „Plan" für strukturierten Lernplan.</p>}
                                    </div>
                                );
                            })}
                            {exams.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Lege erst Prüfungen an.</p>}
                        </div>
                    )}
                    {uTab === "karten" && (() => {
                        const note = uNotes.find(n => n.id === fcNoteId);
                        const cards = note ? flashcards[note.id] : null;
                        const card = cards && cards[fcIdx];
                        return (
                            <div>
                                <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginBottom: "1.25rem" }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Aus Notiz erstellen</p>
                                    {uNotes.length === 0 ? <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: 0 }}>Erst eine Notiz in „Notizen" anlegen.</p> : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {uNotes.map(n => (
                                                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: "var(--border-radius-md)", background: fcNoteId === n.id ? UN.bg : "var(--color-background-secondary)", border: fcNoteId === n.id ? `0.5px solid ${UN.acc}` : "0.5px solid transparent", cursor: "pointer" }} onClick={() => { setFcNoteId(n.id); setFcIdx(0); setFcFlipped(false); }}>
                                                    <span style={{ flex: 1, fontSize: 12, color: "var(--color-text-primary)" }}>{n.topic}</span>
                                                    <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{flashcards[n.id]?.length || 0} Karten</span>
                                                    <button onClick={(e) => { e.stopPropagation(); genFlashcards(n); }} disabled={fcBusy || !keySet} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: keySet ? UN.bg : "var(--color-background-primary)", color: keySet ? UN.acc : "var(--color-text-tertiary)", border: `0.5px solid ${keySet ? UN.br : "transparent"}`, cursor: keySet ? "pointer" : "default" }}>{fcBusy && fcNoteId === n.id ? "..." : "✨"}</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {card && (
                                    <div>
                                        <div onClick={() => setFcFlipped(f => !f)} style={{ minHeight: 180, padding: "1.5rem", borderRadius: "var(--border-radius-lg)", background: fcFlipped ? `linear-gradient(135deg,${UN.bg},rgba(99,102,241,0.06))` : "var(--color-background-secondary)", border: `0.5px solid ${UN.br}`, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", marginBottom: 12 }}>
                                            <p style={{ fontSize: 10, fontWeight: 700, color: UN.acc, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>{fcFlipped ? "Antwort" : "Frage"} · {fcIdx + 1}/{cards.length}</p>
                                            <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0, color: "var(--color-text-primary)" }}>{fcFlipped ? card.a : card.q}</p>
                                            <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "12px 0 0" }}>Tippen zum Umdrehen</p>
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFcFlipped(false); }} disabled={fcIdx === 0} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", cursor: fcIdx > 0 ? "pointer" : "default", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", fontSize: 13, fontWeight: 600, opacity: fcIdx === 0 ? 0.5 : 1 }}>← Zurück</button>
                                            <button onClick={() => { setFcIdx(i => Math.min(cards.length - 1, i + 1)); setFcFlipped(false); }} disabled={fcIdx >= cards.length - 1} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", cursor: fcIdx < cards.length - 1 ? "pointer" : "default", background: UN.bg, border: `0.5px solid ${UN.br}`, color: UN.acc, fontSize: 13, fontWeight: 700, opacity: fcIdx >= cards.length - 1 ? 0.5 : 1 }}>Nächste →</button>
                                        </div>
                                    </div>
                                )}
                                {note && !cards && <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center", margin: "20px 0 0", fontStyle: "italic" }}>Klick ✨ um Karten zu generieren.</p>}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── KALENDER ── */}
            {tab === "kalender" && (() => {
                const days = getCalDays(calDate.getFullYear(), calDate.getMonth());
                const title = calDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
                const todayStr = dk(new Date());
                return (
                    <div>
                        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))} style={{ fontSize: 18, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", cursor: "pointer", color: KL.acc, padding: "4px 12px" }}>‹</button>
                                <p style={{ fontSize: 15, fontWeight: 700, margin: 0, textTransform: "capitalize", ...gTxt("#818cf8", "#818cf8") }}>{title}</p>
                                <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))} style={{ fontSize: 18, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", cursor: "pointer", color: KL.acc, padding: "4px 12px" }}>›</button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                                {DL.map(d => (<div key={d} style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", textAlign: "center", padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{d}</div>))}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                                {days.map((d, i) => {
                                    if (!d) return <div key={i} />;
                                    const ds = dk(d); const isToday = ds === todayStr;
                                    const dayShort = DL[d.getDay() === 0 ? 6 : d.getDay() - 1];
                                    const hasRun = weekRuns[ds] > 0;
                                    const courses = DEF_COURSES.filter(c => c.days.includes(dayShort));
                                    const exam = exams.find(e => e.date === ds);
                                    const sleep = sleepLog.find(s => s.date === ds);
                                    return (
                                        <div key={i} style={{ minHeight: 56, padding: "5px 5px 4px", borderRadius: "var(--border-radius-md)", background: isToday ? `${KL.acc}20` : "var(--color-background-secondary)", border: isToday ? `0.5px solid ${KL.acc}` : "0.5px solid transparent", display: "flex", flexDirection: "column", position: "relative" }}>
                                            <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? KL.acc : "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{d.getDate()}</span>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
                                                {exam && <div style={{ fontSize: 8, fontWeight: 700, color: "#c026d3", background: "rgba(192,38,211,0.15)", padding: "1px 3px", borderRadius: 3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>🎯 {exam.name.split(" ")[0]}</div>}
                                                {courses.length > 0 && <div style={{ fontSize: 8, fontWeight: 700, color: UN.acc, background: UN.bg, padding: "1px 3px", borderRadius: 3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>📚 {courses.length}x</div>}
                                                {hasRun && <div style={{ fontSize: 8, fontWeight: 700, color: SP.acc, background: SP.bg, padding: "1px 3px", borderRadius: 3 }}>🏃 {weekRuns[ds]}m</div>}
                                            </div>
                                            {sleep && <span style={{ position: "absolute", bottom: 3, right: 4, fontSize: 10 }}>{SLEEP_QUAL[sleep.quality] ?? "😴"}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                                {[["🎯", "Klausur", "#c026d3"], ["📚", "Vorlesung", UN.acc], ["🏃", "Lauf", SP.acc], ["😴", "Schlaf", BD.acc]].map(([em, l, c]) => (<div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-text-tertiary)" }}><span>{em}</span><span style={{ color: c, fontWeight: 600 }}>{l}</span></div>))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── COACH ── */}
            {tab === "coach" && (
                <div>
                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
                        <div style={{ padding: "0.875rem 1rem", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "linear-gradient(135deg,rgba(192,38,211,0.06),rgba(99,102,241,0.04))" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700, ...gTxt("#c026d3", "#6366f1") }}>KI-Coach</p><p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>Kennt dein vollständiges Profil.</p></div>
                        <div style={{ padding: "1rem", minHeight: 240, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                            {msgs.length === 0 && (<div><p style={{ color: "var(--color-text-secondary)", fontSize: 12, margin: "0 0 10px" }}>Schnellstart:</p>{["Erstelle meinen Wochenplan", "Was ist mein optimales Wochenvolumen?", "Wie kombiniere ich Sport & Uni?"].map(q => (<button key={q} onClick={() => setChatTxt(q)} style={{ display: "block", textAlign: "left", width: "100%", fontSize: 12, padding: "7px 11px", marginBottom: 5, borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>{q}</button>))}</div>)}
                            {msgs.map((m, i) => (<div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%", background: m.role === "user" ? "rgba(192,38,211,0.1)" : "var(--color-background-secondary)", color: m.role === "user" ? "#c026d3" : "var(--color-text-primary)", padding: "9px 13px", borderRadius: "var(--border-radius-lg)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", border: m.role === "user" ? "0.5px solid rgba(192,38,211,0.2)" : "none" }}>{m.content}</div>))}
                            {chatBusy && <div style={{ alignSelf: "flex-start", background: "var(--color-background-secondary)", padding: "9px 13px", borderRadius: "var(--border-radius-lg)", fontSize: 13, color: "var(--color-text-secondary)" }}>Coach tippt...</div>}
                            <div ref={endRef} />
                        </div>
                        <div style={{ padding: "0.75rem 1rem", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 8 }}><input value={chatTxt} onChange={e => setChatTxt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }} placeholder="Frage deinen Coach..." style={{ flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)" }} /><button onClick={sendChat} disabled={chatBusy || !chatTxt.trim()} style={{ padding: "8px 18px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-md)", cursor: "pointer", border: "none", background: chatTxt.trim() && !chatBusy ? "linear-gradient(135deg,#c026d3,#6366f1)" : "var(--color-background-secondary)", color: chatTxt.trim() && !chatBusy ? "#ffffff" : "var(--color-text-tertiary)" }}>→</button></div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
}