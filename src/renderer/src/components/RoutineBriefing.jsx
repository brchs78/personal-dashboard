// OLE OS — Routine-Briefing / Abend-Debrief
// Morgen: aggregiertes Briefing (Top-3 von gestern, Training heute, ToDos, Habits).
// Abend: Reflexions-Formular (lief gut / lief schlecht / Top-3 für morgen) + Tages-Recap.
// Loop: Abends erfasste Top-3 erscheinen am nächsten Morgen wieder.
import { useEffect, useState } from "react";
import { Sparkles, Target, Activity, CheckSquare, Flame, ThumbsUp, ThumbsDown, Footprints, HeartPulse, TrendingUp, AlertTriangle, Gauge } from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";
import { useDebrief } from "../hooks/useDebrief.js";
import { useTrainingPlan } from "../hooks/useTrainingPlan.js";
import { useTodos } from "../hooks/useTodos.js";
import { useHabits } from "../hooks/useHabits.js";
import { useHealthSummary, useHealthTrend } from "../hooks/useHealth.js";
import { useStrava } from "../hooks/useStrava.js";
import { useTrainingLog, useRecentNiggles } from "../hooks/useTrainingLog.js";
import { computeReadiness, readinessAdvice } from "../lib/readiness.js";
import { computeLoad, loadAdvice } from "../lib/trainingLoad.js";
import { todayISO, addDays } from "../lib/date.js";

const BODY_AREAS = ["Achillessehne", "Knie", "ITB", "Schienbein", "Wade", "Hüfte", "Fuß", "Rücken", "Sonstiges"];
const LEGS_OPTIONS = [
    { key: "fresh", label: "Frisch" },
    { key: "normal", label: "Normal" },
    { key: "heavy", label: "Schwer" },
];

function levelColor(level, tokens) {
    if (level === "green") return tokens.colors.status.success;
    if (level === "amber") return tokens.colors.status.warning || "#d97706";
    if (level === "red") return tokens.colors.status.danger;
    return tokens.colors.text.tertiary;
}

export default function RoutineBriefing({ variant = "morning", accent }) {
    const { tokens } = useTheme();
    const ac = accent || tokens.colors.accent.DEFAULT;

    if (variant === "evening") return <EveningDebrief tokens={tokens} accent={ac} />;
    return <MorningBriefing tokens={tokens} accent={ac} />;
}

// ──────────────────────────────────────────────────────────────────
// Morgen-Briefing
// ──────────────────────────────────────────────────────────────────
function MorningBriefing({ tokens, accent }) {
    const today = todayISO();
    const yesterday = addDays(today, -1);
    const { entry: yEntry } = useDebrief(yesterday);
    const { plan } = useTrainingPlan();
    const { items } = useTodos();
    const { habits, isCheckedIn } = useHabits();
    const { summary } = useHealthSummary();
    const { points: hrvTrend } = useHealthTrend("hrv", 30);
    const { points: rhrTrend } = useHealthTrend("rhr", 30);
    const { points: sleepTrend } = useHealthTrend("sleepTotal", 30);
    const { activities } = useStrava();
    const { niggles } = useRecentNiggles(14);

    const readiness = computeReadiness({
        latest: summary?.latest,
        hrvTrend, rhrTrend, sleepTrend,
    });
    const load = computeLoad(activities);

    const topThree = (yEntry.tomorrowPriorities || []).filter((p) => p.trim());
    const todayDay = (plan?.days || []).find((d) => d.date === today);

    const openTodos = items
        .filter((t) => !t.done && (!t.dueDate || t.dueDate <= today))
        .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"))
        .slice(0, 4);

    const openHabits = habits.filter((h) => !isCheckedIn(h.id, today));

    return (
        <div style={{ ...tokens.glass.cardStrong, padding: "16px 18px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Headline tokens={tokens} accent={accent} icon={Sparkles} text="Morgen-Briefing" />

            {readiness && <ReadinessCard tokens={tokens} readiness={readiness} />}

            {load && <LoadCard tokens={tokens} accent={accent} load={load} />}

            {niggles.length > 0 && <NigglesWarning tokens={tokens} niggles={niggles} />}

            {topThree.length > 0 && (
                <Section tokens={tokens} accent={accent} icon={Target} label="Deine Top-3 für heute">
                    <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                        {topThree.map((p, i) => (
                            <li key={i} style={{ fontSize: 13, color: tokens.colors.text.primary, lineHeight: 1.4 }}>{p}</li>
                        ))}
                    </ol>
                </Section>
            )}

            <Section tokens={tokens} accent={accent} icon={Activity} label="Training heute">
                {todayDay ? (
                    <div style={{ fontSize: 13, color: tokens.colors.text.primary, lineHeight: 1.4 }}>
                        <strong>{todayDay.type}</strong>
                        {todayDay.distanceKm ? ` · ${todayDay.distanceKm} km` : ""}
                        {todayDay.title ? ` — ${todayDay.title}` : ""}
                    </div>
                ) : (
                    <Muted tokens={tokens}>Kein Trainingstag im Plan.</Muted>
                )}
            </Section>

            <Section tokens={tokens} accent={accent} icon={CheckSquare} label={`Offene ToDos${openTodos.length ? ` (${openTodos.length})` : ""}`}>
                {openTodos.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                        {openTodos.map((t) => (
                            <li key={t.id} style={{ fontSize: 13, color: tokens.colors.text.primary, lineHeight: 1.4 }}>
                                {t.title}
                                {t.dueDate && t.dueDate < today && (
                                    <span style={{ color: tokens.colors.status.danger, marginLeft: 6, fontSize: 11 }}>überfällig</span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Muted tokens={tokens}>Nichts Offenes — sauber.</Muted>
                )}
            </Section>

            <Section tokens={tokens} accent={accent} icon={Flame} label={`Habits offen${openHabits.length ? ` (${openHabits.length})` : ""}`}>
                {openHabits.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {openHabits.map((h) => (
                            <span key={h.id} style={{
                                fontSize: 12, padding: "4px 10px", borderRadius: tokens.radius.pill,
                                background: tokens.colors.accent.softer, color: tokens.colors.text.secondary,
                                border: `0.5px solid ${tokens.colors.border.glass}`,
                            }}>{h.emoji ? `${h.emoji} ` : ""}{h.name || h.label}</span>
                        ))}
                    </div>
                ) : (
                    <Muted tokens={tokens}>Alle Habits erledigt.</Muted>
                )}
            </Section>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Abend-Debrief
// ──────────────────────────────────────────────────────────────────
function EveningDebrief({ tokens, accent }) {
    const today = todayISO();
    const { entry, save } = useDebrief(today);
    const { entry: logEntry, save: saveLog } = useTrainingLog(today);
    const { plan, done } = useTrainingPlan();
    const { items } = useTodos();
    const { habits, isCheckedIn } = useHabits();

    // Lokaler Entwurf → speichert on blur (kein Disk-Write pro Tastendruck).
    const [wentWell, setWentWell] = useState("");
    const [wentBad, setWentBad] = useState("");
    const [prios, setPrios] = useState(["", "", ""]);

    useEffect(() => {
        setWentWell(entry.wentWell || "");
        setWentBad(entry.wentBad || "");
        setPrios(entry.tomorrowPriorities || ["", "", ""]);
    }, [entry.date, entry.updatedAt]);

    // Tages-Recap
    const todayDay = (plan?.days || []).find((d) => d.date === today);
    const trainingDone = todayDay ? !!done[today] : null;
    const todosDoneToday = items.filter((t) => t.done && String(t.completedAt || "").slice(0, 10) === today).length;
    const habitsDone = habits.filter((h) => isCheckedIn(h.id, today)).length;

    const inputStyle = {
        ...tokens.glass.input,
        width: "100%",
        padding: "9px 11px",
        fontFamily: tokens.typography.fontFamily.sans,
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.text.primary,
        resize: "vertical",
        boxSizing: "border-box",
    };

    return (
        <div style={{ ...tokens.glass.cardStrong, padding: "16px 18px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Headline tokens={tokens} accent={accent} icon={Sparkles} text="Abend-Debrief" />

            {/* Tages-Recap */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <RecapChip tokens={tokens} accent={accent} icon={Footprints}
                    text={trainingDone === null ? "Kein Training geplant" : trainingDone ? "Training erledigt" : "Training offen"}
                    ok={trainingDone !== false} />
                <RecapChip tokens={tokens} accent={accent} icon={CheckSquare} text={`${todosDoneToday} ToDos erledigt`} ok />
                <RecapChip tokens={tokens} accent={accent} icon={Flame} text={`${habitsDone}/${habits.length} Habits`} ok={habits.length === 0 || habitsDone >= habits.length} />
            </div>

            <TrainingFeedback tokens={tokens} accent={accent} entry={logEntry} save={saveLog} />

            <Section tokens={tokens} accent={accent} icon={ThumbsUp} label="Was lief heute gut?">
                <textarea
                    rows={2}
                    value={wentWell}
                    onChange={(e) => setWentWell(e.target.value)}
                    onBlur={() => save({ wentWell })}
                    placeholder="Ein Erfolg, ein guter Moment…"
                    style={inputStyle}
                />
            </Section>

            <Section tokens={tokens} accent={accent} icon={ThumbsDown} label="Was lief nicht so gut?">
                <textarea
                    rows={2}
                    value={wentBad}
                    onChange={(e) => setWentBad(e.target.value)}
                    onBlur={() => save({ wentBad })}
                    placeholder="Was würdest du anders machen?"
                    style={inputStyle}
                />
            </Section>

            <Section tokens={tokens} accent={accent} icon={Target} label="Top-3 für morgen">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                                fontFamily: tokens.typography.fontFamily.mono, fontSize: 13, fontWeight: 700,
                                color: accent, width: 16, textAlign: "center", flexShrink: 0,
                            }}>{i + 1}</span>
                            <input
                                value={prios[i]}
                                onChange={(e) => setPrios((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                                onBlur={() => save({ tomorrowPriorities: prios })}
                                placeholder={`Priorität ${i + 1}`}
                                style={inputStyle}
                            />
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Bausteine
// ──────────────────────────────────────────────────────────────────
function Headline({ tokens, accent, icon: Icon, text }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={17} strokeWidth={2} style={{ color: accent }} />
            <span style={{
                fontFamily: tokens.typography.fontFamily.sans,
                fontWeight: tokens.typography.fontWeight.bold,
                fontSize: tokens.typography.fontSize.md,
                color: tokens.colors.text.primary,
            }}>{text}</span>
        </div>
    );
}

function Section({ tokens, accent, icon: Icon, label, children }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={13} strokeWidth={2} style={{ color: accent }} />
                <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                    color: tokens.colors.text.tertiary,
                }}>{label}</span>
            </div>
            {children}
        </div>
    );
}

function Muted({ tokens, children }) {
    return <div style={{ fontSize: 13, color: tokens.colors.text.tertiary }}>{children}</div>;
}

function RecapChip({ tokens, accent, icon: Icon, text, ok }) {
    const color = ok ? accent : tokens.colors.status.warning || "#d97706";
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, padding: "5px 10px", borderRadius: tokens.radius.pill,
            background: `${color}14`, color, border: `0.5px solid ${color}40`,
        }}>
            <Icon size={12} strokeWidth={2} />{text}
        </span>
    );
}

// ──────────────────────────────────────────────────────────────────
// Readiness-Karte (Morgen)
// ──────────────────────────────────────────────────────────────────
function ReadinessCard({ tokens, readiness }) {
    const color = levelColor(readiness.level, tokens);
    return (
        <div style={{
            ...tokens.glass.card, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
            borderColor: `${color}55`,
        }}>
            <div style={{
                width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${color}1a`, border: `2px solid ${color}`,
            }}>
                <span style={{
                    fontFamily: tokens.typography.fontFamily.mono, fontSize: 18, fontWeight: 800,
                    color, fontVariantNumeric: "tabular-nums",
                }}>{readiness.score}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <HeartPulse size={14} strokeWidth={2} style={{ color }} />
                    <span style={{
                        fontFamily: tokens.typography.fontFamily.sans, fontWeight: tokens.typography.fontWeight.bold,
                        fontSize: tokens.typography.fontSize.sm, color: tokens.colors.text.primary,
                    }}>Readiness</span>
                    {readiness.stale && (
                        <span style={{ fontSize: 10, color: tokens.colors.text.tertiary }}>· veraltet</span>
                    )}
                </div>
                <div style={{ fontSize: 12.5, color: tokens.colors.text.secondary, marginTop: 2, lineHeight: 1.35 }}>
                    {readinessAdvice(readiness.level)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                    {readiness.factors.map((f) => (
                        <span key={f.key} style={{ fontSize: 10.5, color: tokens.colors.text.tertiary }}>
                            {f.key} {f.score}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Load / ACWR-Karte (Morgen)
// ──────────────────────────────────────────────────────────────────
function LoadCard({ tokens, accent, load }) {
    const zoneColor = load.zone === "high" ? tokens.colors.status.danger
        : load.zone === "caution" ? (tokens.colors.status.warning || "#d97706")
        : load.zone === "low" ? tokens.colors.text.tertiary
        : tokens.colors.status.success;
    return (
        <div style={{ ...tokens.glass.card, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={13} strokeWidth={2} style={{ color: accent }} />
                <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                    color: tokens.colors.text.tertiary,
                }}>Belastung</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <LoadStat tokens={tokens} value={`${load.acuteKm}`} unit="km" label="diese Woche" />
                <LoadStat tokens={tokens} value={`${load.chronicWeeklyKm}`} unit="km" label="4-Wo-Schnitt" />
                {load.ratio != null && (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            fontFamily: tokens.typography.fontFamily.mono, fontSize: 16, fontWeight: 800,
                            color: zoneColor, fontVariantNumeric: "tabular-nums", lineHeight: 1,
                        }}>{load.ratio.toFixed(2)}</div>
                        <div style={{ fontSize: 9, color: tokens.colors.text.tertiary, textTransform: "uppercase", marginTop: 2 }}>ACWR</div>
                    </div>
                )}
            </div>
            <div style={{ fontSize: 12, color: zoneColor, lineHeight: 1.35 }}>
                {loadAdvice(load.zone)}
                {load.rampPct != null && load.rampPct > 10 && ` · +${load.rampPct}% ggü. Vorwoche`}
            </div>
        </div>
    );
}

function LoadStat({ tokens, value, unit, label }) {
    return (
        <div style={{ textAlign: "center" }}>
            <div style={{
                fontFamily: tokens.typography.fontFamily.mono, fontSize: 16, fontWeight: 800,
                color: tokens.colors.text.primary, fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>{value}<span style={{ fontSize: 10, fontWeight: 600, color: tokens.colors.text.tertiary }}> {unit}</span></div>
            <div style={{ fontSize: 9, color: tokens.colors.text.tertiary, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Niggle-Warnung (Morgen)
// ──────────────────────────────────────────────────────────────────
function NigglesWarning({ tokens, niggles }) {
    const warn = tokens.colors.status.warning || "#d97706";
    return (
        <div style={{ ...tokens.glass.card, padding: "12px 16px", borderColor: `${warn}55`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} strokeWidth={2} style={{ color: warn }} />
                <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: warn,
                }}>Niggles im Blick ({niggles.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {niggles.slice(0, 4).map((n, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.35 }}>
                        <strong style={{ color: tokens.colors.text.primary }}>{n.area}</strong>
                        {" "}{"●".repeat(n.severity)}
                        {n.note ? ` — ${n.note}` : ""}
                        <span style={{ color: tokens.colors.text.tertiary }}> · vor {n.age}d</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// Training-Feedback (Abend): RPE, Beine, Niggles
// ──────────────────────────────────────────────────────────────────
function TrainingFeedback({ tokens, accent, entry, save }) {
    const [newArea, setNewArea] = useState(BODY_AREAS[0]);
    const [newSev, setNewSev] = useState(1);
    const [newNote, setNewNote] = useState("");

    const niggles = entry.niggles || [];

    function addNiggle() {
        if (!newArea) return;
        save({ niggles: [...niggles, { area: newArea, severity: newSev, note: newNote.trim() }] });
        setNewNote("");
        setNewSev(1);
    }
    function removeNiggle(idx) {
        save({ niggles: niggles.filter((_, i) => i !== idx) });
    }

    return (
        <Section tokens={tokens} accent={accent} icon={Gauge} label="Training-Feedback">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* RPE 1–10 */}
                <div>
                    <div style={{ fontSize: 11.5, color: tokens.colors.text.tertiary, marginBottom: 5 }}>Anstrengung (RPE)</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                            const active = entry.rpe === n;
                            return (
                                <button key={n} onClick={() => save({ rpe: active ? null : n })}
                                    style={{
                                        width: 28, height: 28, borderRadius: tokens.radius.md, cursor: "pointer",
                                        border: `0.5px solid ${active ? accent : tokens.colors.border.glass}`,
                                        background: active ? accent : "transparent",
                                        color: active ? "#fff" : tokens.colors.text.secondary,
                                        fontFamily: tokens.typography.fontFamily.mono, fontSize: 12, fontWeight: 700,
                                    }}>{n}</button>
                            );
                        })}
                    </div>
                </div>

                {/* Beine */}
                <div>
                    <div style={{ fontSize: 11.5, color: tokens.colors.text.tertiary, marginBottom: 5 }}>Beine</div>
                    <div style={{ display: "flex", gap: 6 }}>
                        {LEGS_OPTIONS.map((o) => {
                            const active = entry.legs === o.key;
                            return (
                                <button key={o.key} onClick={() => save({ legs: active ? null : o.key })}
                                    style={{
                                        padding: "6px 12px", borderRadius: tokens.radius.pill, cursor: "pointer",
                                        border: `0.5px solid ${active ? accent : tokens.colors.border.glass}`,
                                        background: active ? `${accent}1a` : "transparent",
                                        color: active ? accent : tokens.colors.text.secondary,
                                        fontSize: 12, fontWeight: 600,
                                    }}>{o.label}</button>
                            );
                        })}
                    </div>
                </div>

                {/* Niggles */}
                <div>
                    <div style={{ fontSize: 11.5, color: tokens.colors.text.tertiary, marginBottom: 5 }}>Niggles / Wehwehchen</div>
                    {niggles.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
                            {niggles.map((n, i) => (
                                <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 6, fontSize: 12.5,
                                    color: tokens.colors.text.secondary,
                                }}>
                                    <strong style={{ color: tokens.colors.text.primary }}>{n.area}</strong>
                                    <span>{"●".repeat(n.severity)}</span>
                                    {n.note ? <span>— {n.note}</span> : null}
                                    <button onClick={() => removeNiggle(i)} title="Entfernen" style={{
                                        marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer",
                                        color: tokens.colors.status.danger, fontSize: 14, lineHeight: 1,
                                    }}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={newArea} onChange={(e) => setNewArea(e.target.value)}
                            style={{ ...tokens.glass.input, padding: "6px 8px", fontSize: 12, color: tokens.colors.text.primary, cursor: "pointer" }}>
                            {BODY_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={newSev} onChange={(e) => setNewSev(Number(e.target.value))}
                            style={{ ...tokens.glass.input, padding: "6px 8px", fontSize: 12, color: tokens.colors.text.primary, cursor: "pointer" }}>
                            <option value={1}>leicht</option>
                            <option value={2}>mittel</option>
                            <option value={3}>stark</option>
                        </select>
                        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Notiz (optional)"
                            style={{ ...tokens.glass.input, flex: 1, minWidth: 100, padding: "6px 8px", fontSize: 12, color: tokens.colors.text.primary }} />
                        <button onClick={addNiggle} style={{
                            padding: "6px 12px", borderRadius: tokens.radius.md, cursor: "pointer",
                            border: `0.5px solid ${accent}`, background: `${accent}1a`, color: accent,
                            fontSize: 12, fontWeight: 600,
                        }}>+ Niggle</button>
                    </div>
                </div>
            </div>
        </Section>
    );
}
