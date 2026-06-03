import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import CoachHome from "./components/CoachHome";
import Health from "./components/Health";
import TrainingPlan from "./components/TrainingPlan";
import Calendar from "./components/Calendar";
import Todos from "./components/Todos";
import HabitHub from "./components/HabitHub";
import RoutineHub from "./components/RoutineHub";
import { useTheme } from "./hooks/useTheme.jsx";

// ── Speicher-Adapter: nutzt window.storage (Claude) oder localStorage (Electron) ──
const store = (typeof window !== "undefined" && window.storage) ? window.storage : {
    get: async (k) => { const v = localStorage.getItem(k); return v !== null ? { value: v } : null; },
    set: async (k, v) => { localStorage.setItem(k, v); },
};
const getKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("ole:api-key") || "" : "");

// ── Colors ── (Token-basierte Tab-Palette, wird in App() mit useMemo gebaut)
function mkPal(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return { acc: hex, bg: `rgba(${r},${g},${b},0.10)`, br: `rgba(${r},${g},${b},0.25)` };
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
// blockClr moved inside App() — needs SP/UN from useTheme
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
    const { tokens, mode, toggle } = useTheme();
    const SP = useMemo(() => mkPal(tokens.colors.tab.workout), [tokens]);
    const UN = useMemo(() => mkPal(tokens.colors.tab.uni), [tokens]);
    const BD = useMemo(() => mkPal(tokens.colors.tab.body), [tokens]);
    const KL = useMemo(() => mkPal(tokens.colors.tab.calendar), [tokens]);
    function blockClr(t) { return t === "sport" ? SP : t === "uni" ? UN : { acc: "#999", bg: "rgba(128,128,128,0.06)", br: "rgba(128,128,128,0.12)" }; }

    const [tab, setTab] = useState("dash");
    const [uTab, setUTab] = useState("pruefungen");
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState(getKey());
    const [keySet, setKeySet] = useState(!!getKey());
    const [elKey, setElKey] = useState(() => localStorage.getItem("ole:elevenlabs-key") || "");
    const [elVoice, setElVoice] = useState(() => localStorage.getItem("ole:elevenlabs-voice-id") || "");

    const [plan, setPlan] = useState(null);
    const [planBusy, setPlanBusy] = useState(true);
    const [weekRuns, setWeekRuns] = useState({});

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

    // ── NEW STATE ──
    const [bodyTab, setBodyTab] = useState("schlaf");
    const [sleepLog, setSleepLog] = useState([]);
    const [weightLog, setWeightLog] = useState([]);
    const [recoveryLog, setRecoveryLog] = useState([]);
    const [sleepH, setSleepH] = useState(""); const [sleepQ, setSleepQ] = useState(null);
    const [wgInput, setWgInput] = useState("");
    const [rstHR, setRstHR] = useState(""); const [rstStress, setRstStress] = useState(null);
    const [maxHR, setMaxHR] = useState(197);
    const [weekReview, setWeekReview] = useState(null); const [wrBusy, setWrBusy] = useState(false);
    const [flashcards, setFlashcards] = useState({}); const [fcBusy, setFcBusy] = useState(false);
    const [fcNoteId, setFcNoteId] = useState(null);
    const [fcIdx, setFcIdx] = useState(0); const [fcFlipped, setFcFlipped] = useState(false);
    const [studyPlans, setStudyPlans] = useState({}); const [spBusy, setSpBusy] = useState(null);
    const [calDate, setCalDate] = useState(new Date());
    const [healthSrc, setHealthSrc] = useState(null);
    const [vaultSettings, setVaultSettings] = useState(null);
    const [vaultBusy, setVaultBusy] = useState(false);
    const [vaultMsg, setVaultMsg] = useState(null);

    useEffect(() => {
        if (!showSettings) return;
        window.oleAPI?.health?.sourceStatus?.().then(s => setHealthSrc(s)).catch(() => {});
        window.oleAPI?.vault?.getSettings?.().then(s => setVaultSettings(s)).catch(() => {});
    }, [showSettings]);

    useEffect(() => {
        if (!window.oleAPI?.vault?.onUpdated) return;
        return window.oleAPI.vault.onUpdated((s) => setVaultSettings(s));
    }, []);

    async function vaultPickPath() {
        try {
            const s = await window.oleAPI.vault.setPath();
            setVaultSettings(s);
        } catch (e) { setVaultMsg(`Fehler: ${e?.message || e}`); }
    }
    async function vaultExportNow() {
        setVaultBusy(true); setVaultMsg(null);
        try {
            const res = await window.oleAPI.vault.exportToday();
            setVaultMsg(res?.ok ? `Export OK · ${res.date}` : `Fehler: ${res?.error || 'unbekannt'}`);
        } catch (e) { setVaultMsg(`Fehler: ${e?.message || e}`); }
        setVaultBusy(false);
    }
    async function vaultToggleAuto(enabled) {
        try {
            const s = await window.oleAPI.vault.setAutoExport(enabled);
            setVaultSettings(s);
        } catch (e) { setVaultMsg(`Fehler: ${e?.message || e}`); }
    }
    async function vaultToggleCoach(enabled) {
        try {
            const s = await window.oleAPI.vault.setExportCoach(enabled);
            setVaultSettings(s);
        } catch (e) { setVaultMsg(`Fehler: ${e?.message || e}`); }
    }
    async function vaultBackfill30() {
        if (!vaultSettings?.path) return;
        setVaultBusy(true); setVaultMsg(null);
        const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29);
        try {
            const res = await window.oleAPI.vault.exportRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
            setVaultMsg(res?.ok ? `Backfill OK · ${res.count} Tage` : `Fehler: ${res?.error || 'unbekannt'}`);
        } catch (e) { setVaultMsg(`Fehler: ${e?.message || e}`); }
        setVaultBusy(false);
    }

    useEffect(() => {
        loadAll();
        // Escape blendet Fenster aus (Electron)
        const onKey = (e) => { if (e.key === "Escape" && window.oleAPI) window.oleAPI.hideWindow(); };
        window.addEventListener("keydown", onKey);
        // Reagiere auf automatische Morgen-Routine
        if (window.oleAPI?.onRoutine) window.oleAPI.onRoutine((id) => { if (id === "morning") { setTab("dash"); genPlan(); } if (id === "evening") { setTab("habit"); } });
        return () => { clearInterval(pomRef.current); window.removeEventListener("keydown", onKey); };
    }, []);
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
        localStorage.setItem("ole:elevenlabs-key", elKey.trim());
        localStorage.setItem("ole:elevenlabs-voice-id", elVoice.trim());
        setKeySet(!!apiKey.trim());
        setShowSettings(false);
        if (apiKey.trim()) { genPlan(); }
    }

    async function loadAll() {
        try {
            const ks = ["ole:day-plan", "ole:todos", "ole:week-runs", "ole:w-ana", "ole:exams", "ole:grades", "ole:u-notes",
                "ole:sleep-log", "ole:weight-log", "ole:recovery-log", "ole:t-plan", "ole:flashcards", "ole:study-plans", "ole:max-hr"];
            const rs = await Promise.allSettled(ks.map(k => store.get(k)));
            const g = (i) => { try { return rs[i].value ? JSON.parse(rs[i].value.value) : null; } catch { return null; } };
            const p = g(0); if (p && p.day === new Date().toDateString()) { setPlan(p.p); setPlanBusy(false); } else genPlan();
            // ToDos: einmalige Migration der alten localStorage-Items in den neuen Main-Store
            const legacyTodos = g(1);
            if (Array.isArray(legacyTodos) && legacyTodos.length && window.oleAPI?.todo) {
                try {
                    await window.oleAPI.todo.migrate(legacyTodos);
                    localStorage.removeItem("ole:todos");
                } catch (e) { console.warn("todo migrate failed:", e); }
            }
            if (g(2)) setWeekRuns(g(2));
            if (g(4)) setExams(g(4)); if (g(5)) setGrades(g(5)); if (g(6)) setUNotes(g(6));
            if (g(7)) setSleepLog(g(7)); if (g(8)) setWeightLog(g(8)); if (g(9)) setRecoveryLog(g(9));
            if (g(11)) setFlashcards(g(11) || {}); if (g(12)) setStudyPlans(g(12) || {});
            if (g(13)) setMaxHR(g(13));
        } catch { genPlan(); }
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

    async function genNote() {
        if (!nTop.trim()) return; setNBusy(true);
        try {
            const c = await callAI([{ role: "user", content: `Lernzusammenfassung für VWL-Student 2. Semester über: "${nTop}". Klar gegliedert, max 350 Wörter.` }], 600);
            const n = { id: Date.now(), topic: nTop, content: c, date: new Date().toLocaleDateString("de-DE") };
            const up = [n, ...uNotes].slice(0, 20); setUNotes(up); save("ole:u-notes", up); setNTop("");
        } catch { }
        setNBusy(false);
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
    const weekDts = getWeekDates();
    const tdKey = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date().getDay()];
    const tEcts = grades.reduce((s, g) => s + parseInt(g.ects || 0), 0);
    const ns = grades.length ? (grades.reduce((s, g) => s + parseFloat(g.grade || 0) * parseInt(g.ects || 0), 0) / tEcts).toFixed(2) : null;
    const pR = 54, pC = 2 * Math.PI * pR, pTot = pomBreak ? 5 * 60 : 25 * 60, pOff = pC * (1 - (pTot - pomSecs) / pTot);

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
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>ElevenLabs API Key <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>optional · Voice-Modus</span></p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Für eine hochwertige Coach-Stimme. Key auf elevenlabs.io/app/settings/api-keys</p>
                        <input type="password" value={elKey} onChange={e => setElKey(e.target.value)} placeholder="sk_..." style={{ ...INP, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>ElevenLabs Voice ID</p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Stimme aus elevenlabs.io/voice-library wählen, ID aus der URL kopieren.</p>
                        <input type="text" value={elVoice} onChange={e => setElVoice(e.target.value)} placeholder="EXAVITQu4vr4xnSDxMaL" style={{ ...INP, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Max-Herzfrequenz <span style={{ fontWeight: 400, color: "var(--color-text-tertiary)" }}>bpm</span></p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Für die Puls-Zonen-Berechnung. Faustregel: 220 − Alter.</p>
                        <input type="number" value={maxHR} onChange={e => setMaxHR(parseInt(e.target.value) || 197)} onBlur={() => save("ole:max-hr", maxHR)} style={{ ...INP, marginBottom: 12 }} />
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Erscheinungsbild</p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Zwischen hellem und dunklem Modus wechseln.</p>
                        <button onClick={toggle} style={{ width: "100%", padding: "10px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", marginBottom: 16 }}>{mode === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Apple Health</p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>App erkennt automatisch wenn eine neue Export.xml vorhanden ist (alle 30 Min). Richte einen Shortcut ein der täglich exportiert.</p>
                        <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                            {healthSrc == null ? "Lade…" : healthSrc.sourceExists
                                ? <><span style={{ color: tokens.colors.status?.success ?? "#22c55e" }}>✓</span>{" "}Export gefunden · {healthSrc.exportDate ? `Exportiert ${new Date(healthSrc.exportDate).toLocaleDateString("de-DE")}` : "Datum unbekannt"}</>
                                : <><span style={{ color: tokens.colors.status?.warning ?? "#f59e0b" }}>⚠</span>{" "}Kein Export gefunden — lege <code style={{ fontSize: 11 }}>~/apple_health_export/Export.xml</code> an</>}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Obsidian Vault</p>
                        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>Exportiert Training, Habits und einen Tages-Index als Markdown in deinen Vault. Bridge für Claude Code, Gemini & Co.</p>
                        <div style={{ fontSize: 11, padding: "8px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)", marginBottom: 8, fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                            {vaultSettings?.path ? vaultSettings.path : "Kein Pfad gesetzt"}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <button onClick={vaultPickPath} style={{ flex: 1, padding: "8px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontSize: 12, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)" }}>Pfad wählen…</button>
                            <button onClick={vaultExportNow} disabled={!vaultSettings?.path || vaultBusy} style={{ flex: 1, padding: "8px", borderRadius: "var(--border-radius-md)", cursor: vaultSettings?.path && !vaultBusy ? "pointer" : "not-allowed", opacity: vaultSettings?.path && !vaultBusy ? 1 : 0.5, fontSize: 12, background: tokens.colors.accent.soft, border: `0.5px solid ${tokens.colors.accent.border}`, color: tokens.colors.accent.DEFAULT }}>{vaultBusy ? "Exportiere…" : "Jetzt exportieren"}</button>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!vaultSettings?.autoExport} onChange={(e) => vaultToggleAuto(e.target.checked)} disabled={!vaultSettings?.path} />
                            Täglich 21:30 automatisch exportieren
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!vaultSettings?.exportCoach} onChange={(e) => vaultToggleCoach(e.target.checked)} disabled={!vaultSettings?.path} />
                            Coach-Chat mit-exportieren <span style={{ color: "var(--color-text-tertiary)" }}>(in _ai/coach-sessions/)</span>
                        </label>
                        <button onClick={vaultBackfill30} disabled={!vaultSettings?.path || vaultBusy} style={{ width: "100%", padding: "8px", borderRadius: "var(--border-radius-md)", cursor: vaultSettings?.path && !vaultBusy ? "pointer" : "not-allowed", opacity: vaultSettings?.path && !vaultBusy ? 1 : 0.5, fontSize: 12, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", marginBottom: 4 }}>
                            {vaultBusy ? "Backfill läuft…" : "Backfill: letzte 30 Tage exportieren"}
                        </button>
                        {vaultMsg && <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "4px 0 0" }}>{vaultMsg}</p>}
                        {vaultSettings?.lastExport && <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "4px 0 12px" }}>Letzter Export: {new Date(vaultSettings.lastExport).toLocaleString("de-DE")}</p>}
                        {!vaultSettings?.lastExport && <div style={{ marginBottom: 12 }} />}
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveKey} style={{ flex: 1, padding: "10px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 700, fontSize: 13, border: "none", background: tokens.colors.accent.DEFAULT, color: "#ffffff" }}>Speichern</button>
                            <button onClick={() => setShowSettings(false)} style={{ padding: "10px 16px", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontSize: 13, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}>Abbrechen</button>
                        </div>
                    </div>
                </div>
            )}

            {/* API KEY BANNER */}
            {!keySet && (
                <div onClick={() => setShowSettings(true)} style={{ cursor: "pointer", fontSize: 12, background: tokens.colors.accent.soft, color: tokens.colors.accent.DEFAULT, padding: "10px 13px", borderRadius: "var(--border-radius-md)", marginBottom: 16, border: `0.5px solid ${tokens.colors.accent.border}`, lineHeight: 1.5 }}>
                    ⚙ KI-Features sind noch aus. Tippe hier um deinen API Key einzutragen.
                </div>
            )}

            {/* ── HOME (Coach) ── */}
            {tab === "dash" && <CoachHome />}

            {/* ── HEALTH ── */}
            {tab === "health" && <Health />}

            {/* ── CALENDAR ── */}
            {tab === "cal" && <Calendar />}

            {/* ── TRAINING PLAN ── */}
            {tab === "training" && <TrainingPlan />}

            {/* ── TODO ── */}
            {tab === "todo" && <Todos />}

            {/* ── HABITS ── */}
            {tab === "habit" && <HabitHub />}

            {/* ── ROUTINE ── */}
            {tab === "routine" && <RoutineHub />}

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
                                        const optimal = hrs >= 7 && hrs <= 9; const clr = optimal ? BD.acc : hrs >= 6 ? tokens.colors.accent.secondary : tokens.colors.status.danger;
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
                                <button onClick={saveSleep} disabled={!sleepH} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: sleepH ? "pointer" : "default", border: "none", background: sleepH ? tokens.colors.accent.DEFAULT : "var(--color-background-secondary)", color: sleepH ? "#ffffff" : "var(--color-text-tertiary)" }}>Speichern</button>
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
                                            <p style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-1.5px", ...gTxt(tokens.colors.accent.secondary, tokens.colors.tab.calendar) }}>{cur ?? "–"}<span style={{ fontSize: 14, fontWeight: 600 }}> kg</span></p>
                                        </div>
                                        {trend !== null && <div style={{ textAlign: "right" }}>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Trend 7d</p>
                                            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: parseFloat(trend) > 0 ? tokens.colors.accent.DEFAULT : BD.acc }}>{trend > 0 ? "+" : ""}{trend} kg</p>
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
                                    <button onClick={saveWeight} disabled={!wgInput} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: wgInput ? "pointer" : "default", border: "none", background: wgInput ? tokens.colors.accent.DEFAULT : "var(--color-background-secondary)", color: wgInput ? "#ffffff" : "var(--color-text-tertiary)" }}>Speichern</button>
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
                                        <p style={{ fontSize: 56, fontWeight: 800, margin: 0, letterSpacing: "-2.5px", ...gTxt(tokens.colors.accent.secondary, tokens.colors.tab.calendar) }}>{today.score}<span style={{ fontSize: 16, fontWeight: 600 }}>/10</span></p>
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
                                    <button onClick={saveRecovery} disabled={!rstHR} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: "var(--border-radius-lg)", cursor: rstHR ? "pointer" : "default", border: "none", background: rstHR ? tokens.colors.accent.DEFAULT : "var(--color-background-secondary)", color: rstHR ? "#ffffff" : "var(--color-text-tertiary)" }}>Recovery berechnen</button>
                                </div>
                                {recoveryLog.length > 1 && (
                                    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem", marginTop: "1.25rem" }}>
                                        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Letzte Werte</p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            {recoveryLog.slice(0, 7).map((r, i) => (
                                                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, padding: "6px 10px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}>
                                                    <span style={{ color: "var(--color-text-tertiary)", minWidth: 80 }}>{r.date}</span>
                                                    <span style={{ flex: 1, color: "var(--color-text-secondary)" }}>{r.restHR} bpm</span>
                                                    <span style={{ fontWeight: 700, color: r.score >= 7 ? BD.acc : r.score >= 5 ? tokens.colors.accent.secondary : tokens.colors.status.danger }}>{r.score}/10</span>
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
                                    const clr = z === 1 ? tokens.colors.tab.calendar : z === 2 ? tokens.colors.accent.secondary : z === 3 ? tokens.colors.accent.secondary : z === 4 ? tokens.colors.accent.DEFAULT : tokens.colors.status.danger;
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
                                    const d = dTo(ex.date), urg = d <= 14, c = urg ? SP : UN; return (
                                        <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: c.bg, border: `0.5px solid ${c.br}` }}>
                                            <div style={{ textAlign: "center", minWidth: 46 }}><p style={{ fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-1.5px", ...gTxt(c.acc, tokens.colors.accent.secondary) }}>{d}</p><p style={{ fontSize: 9, color: "var(--color-text-tertiary)", margin: 0, fontWeight: 700 }}>TAGE</p></div>
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
                                <svg width="148" height="148" viewBox="0 0 148 148"><circle cx="74" cy="74" r={pR} fill="none" stroke="rgba(61,57,41,0.08)" strokeWidth="9" /><circle cx="74" cy="74" r={pR} fill="none" stroke={pomBreak ? tokens.colors.accent.secondary : SP.acc} strokeWidth="9" strokeLinecap="round" strokeDasharray={pC} strokeDashoffset={pOff} transform="rotate(-90 74 74)" style={{ transition: "stroke-dashoffset 0.5s ease" }} /></svg>
                                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><p style={{ fontSize: 30, fontWeight: 800, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-1px", ...gTxt(tokens.colors.accent.secondary, pomBreak ? tokens.colors.tab.calendar : tokens.colors.accent.DEFAULT) }}>{fmtT(pomSecs)}</p><p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-tertiary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.12em" }}>{pomBreak ? "PAUSE" : "FOKUS"}</p></div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><select value={pomSubj} onChange={e => setPomSubj(e.target.value)} style={{ ...INP, width: "auto", fontSize: 13 }}>{DEF_COURSES.map(c => <option key={c.id}>{c.short}</option>)}</select><span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{pomCount} heute</span></div>
                            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setPomRun(r => !r)} style={{ padding: "11px 32px", borderRadius: "var(--border-radius-lg)", cursor: "pointer", fontWeight: 700, fontSize: 15, border: "none", background: pomRun ? "var(--color-background-secondary)" : tokens.colors.accent.DEFAULT, color: pomRun ? "var(--color-text-secondary)" : "#ffffff" }}>{pomRun ? "Pause ⏸" : "Start ▶"}</button><button onClick={() => { setPomRun(false); setPomSecs(25 * 60); setPomBreak(false); }} style={{ padding: "11px 20px", borderRadius: "var(--border-radius-lg)", cursor: "pointer", fontSize: 14, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}>Reset</button></div>
                        </div>
                    )}
                    {uTab === "kurse" && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{DEF_COURSES.map(c => { const isT = c.days.includes(tdKey); return (<div key={c.id} style={{ padding: "12px 14px", borderRadius: "var(--border-radius-md)", background: isT ? UN.bg : "var(--color-background-secondary)", border: `0.5px solid ${isT ? UN.acc : "transparent"}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 3px", color: isT ? UN.acc : "var(--color-text-primary)" }}>{c.name}</p><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{c.days.join(" · ")} · {c.time} · {c.room}</p></div><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: UN.bg, color: UN.acc, border: `0.5px solid ${UN.br}`, flexShrink: 0, marginLeft: 8 }}>{c.ects} ECTS</span></div>{isT && <p style={{ fontSize: 11, color: UN.acc, margin: "6px 0 0", fontWeight: 700 }}>↑ Heute</p>}</div>); })}</div>)}
                    {uTab === "noten" && (
                        <div>
                            {ns && <div style={{ padding: "16px", borderRadius: "var(--border-radius-lg)", background: `linear-gradient(135deg,${UN.bg},rgba(99,102,241,0.08))`, border: `0.5px solid ${UN.br}`, marginBottom: 16, textAlign: "center" }}><p style={{ fontSize: 11, fontWeight: 700, color: UN.acc, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>Notenschnitt</p><p style={{ fontSize: 42, fontWeight: 800, margin: 0, letterSpacing: "-2px", ...gTxt(tokens.colors.accent.DEFAULT, tokens.colors.accent.secondary) }}>{ns}</p><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>{tEcts} ECTS</p></div>}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>{grades.map((g, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-secondary)" }}><span style={{ flex: 1, fontSize: 13 }}>{g.course}</span><span style={{ fontSize: 18, fontWeight: 800, color: UN.acc, fontVariantNumeric: "tabular-nums" }}>{g.grade}</span><span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{g.ects} ECTS</span><button onClick={() => { const g2 = grades.filter((_, j) => j !== i); setGrades(g2); save("ole:grades", g2); }} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>×</button></div>))}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={gCrs} onChange={e => setGCrs(e.target.value)} placeholder="Fach" style={{ ...INP, flex: 2, minWidth: 100 }} /><input type="number" step="0.1" value={gVal} onChange={e => setGVal(e.target.value)} placeholder="1.7" style={{ ...INP, flex: 1, minWidth: 60 }} /><input type="number" value={gEcts} onChange={e => setGEcts(e.target.value)} placeholder="ECTS" style={{ ...INP, flex: 1, minWidth: 60 }} /><button onClick={() => { if (!gCrs || !gVal) return; const g2 = [...grades, { course: gCrs, grade: gVal, ects: gEcts || 6 }]; setGrades(g2); save("ole:grades", g2); setGCrs(""); setGVal(""); setGEcts(""); }} style={{ padding: "9px 14px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: UN.bg, color: UN.acc, border: `0.5px solid ${UN.br}`, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>+ Note</button></div>
                        </div>
                    )}
                    {uTab === "notizen" && (
                        <div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input value={nTop} onChange={e => setNTop(e.target.value)} onKeyDown={e => { if (e.key === "Enter") genNote(); }} placeholder="Thema, z.B. Preiselastizität..." style={{ ...INP, flex: 1 }} /><button onClick={genNote} disabled={!nTop.trim() || nBusy} style={{ padding: "9px 16px", borderRadius: "var(--border-radius-md)", cursor: "pointer", background: tokens.colors.accent.DEFAULT, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, flexShrink: 0, opacity: nTop.trim() && !nBusy ? 1 : 0.5 }}>{nBusy ? "..." : "✨ Erstellen"}</button></div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{uNotes.map(n => (<div key={n.id} style={{ padding: "12px 14px", borderRadius: "var(--border-radius-lg)", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><p style={{ fontSize: 14, fontWeight: 700, margin: 0, ...gTxt(tokens.colors.accent.DEFAULT, tokens.colors.accent.secondary) }}>{n.topic}</p><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{n.date}</span><button onClick={() => { const up = uNotes.filter(x => x.id !== n.id); setUNotes(up); save("ole:u-notes", up); }} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}>×</button></div></div><p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.content}</p></div>))}{uNotes.length === 0 && !nBusy && <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Gib ein Thema ein für eine KI-Zusammenfassung.</p>}</div>
                        </div>
                    )}
                    {uTab === "vorbereitung" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[...exams].sort((a, b) => new Date(a.date) - new Date(b.date)).map(ex => {
                                const d = dTo(ex.date); const sp = studyPlans[ex.id];
                                return (
                                    <div key={ex.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.125rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div><p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px", ...gTxt(tokens.colors.accent.DEFAULT, tokens.colors.accent.secondary) }}>{ex.name}</p><p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>{d} Tage</p></div>
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
                                <p style={{ fontSize: 15, fontWeight: 700, margin: 0, textTransform: "capitalize", ...gTxt(tokens.colors.tab.calendar, tokens.colors.tab.calendar) }}>{title}</p>
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
                                                {exam && <div style={{ fontSize: 8, fontWeight: 700, color: tokens.colors.accent.DEFAULT, background: tokens.colors.accent.soft, padding: "1px 3px", borderRadius: 3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>🎯 {exam.name.split(" ")[0]}</div>}
                                                {courses.length > 0 && <div style={{ fontSize: 8, fontWeight: 700, color: UN.acc, background: UN.bg, padding: "1px 3px", borderRadius: 3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>📚 {courses.length}x</div>}
                                                {hasRun && <div style={{ fontSize: 8, fontWeight: 700, color: SP.acc, background: SP.bg, padding: "1px 3px", borderRadius: 3 }}>🏃 {weekRuns[ds]}m</div>}
                                            </div>
                                            {sleep && <span style={{ position: "absolute", bottom: 3, right: 4, fontSize: 10 }}>{SLEEP_QUAL[sleep.quality] ?? "😴"}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                                {[["🎯", "Klausur", SP.acc], ["📚", "Vorlesung", UN.acc], ["🏃", "Lauf", SP.acc], ["😴", "Schlaf", BD.acc]].map(([em, l, c]) => (<div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-text-tertiary)" }}><span>{em}</span><span style={{ color: c, fontWeight: 600 }}>{l}</span></div>))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            </main>
        </div>
    );
}