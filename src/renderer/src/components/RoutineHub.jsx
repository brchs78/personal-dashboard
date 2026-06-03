// OLE OS — Routine Hub (Morgen-/Abendroutine)
// Zeigt die Routine als Timeline mit dynamisch berechneten Zeiten ab Aufwachzeit.
// Aufwachzeit ist einstellbar; alle Zeiten + Spezialregeln verschieben sich live.
import { useState } from "react";
import { Sunrise, Moon, Clock, CheckCircle2 } from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";
import { useRoutine } from "../hooks/useRoutine.js";

// Kategorie → Tint (über Tokens, kein hartes Farbschema).
function categoryColor(category, tokens) {
    switch (category) {
        case "Körper":    return tokens.colors.tab.workout;
        case "Ernährung": return tokens.colors.status.success;
        case "Mentales":  return tokens.colors.accent.secondary;
        case "Routine":
        default:          return tokens.colors.tab.uni;
    }
}

const ROUTINE_TABS = [
    { id: "morning", label: "Morgen", icon: Sunrise, enabled: true },
    { id: "evening", label: "Abend", icon: Moon, enabled: false },
];

export default function RoutineHub() {
    const { tokens, mode } = useTheme();
    const [activeId, setActiveId] = useState("morning");
    const { schedule, setWakeTime } = useRoutine(activeId);
    const accent = tokens.colors.tab.routine;

    const isMonday = new Date().getDay() === 1;

    return (
        <div
            style={{
                height: "calc(100vh - 40px)",
                overflowY: "auto",
                padding: "16px 4px 32px",
                maxWidth: 720,
                width: "100%",
                margin: "0 auto",
            }}
        >
            {/* ── Header: Routine-Switch ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {ROUTINE_TABS.map(({ id, label, icon: Icon, enabled }) => {
                    const active = id === activeId;
                    return (
                        <button
                            key={id}
                            onClick={() => enabled && setActiveId(id)}
                            disabled={!enabled}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                padding: "8px 14px",
                                borderRadius: tokens.radius.pill,
                                border: `0.5px solid ${active ? accent : tokens.colors.border.glass}`,
                                background: active ? `${accent}1a` : "transparent",
                                color: active ? accent : tokens.colors.text.secondary,
                                cursor: enabled ? "pointer" : "not-allowed",
                                opacity: enabled ? 1 : 0.45,
                                fontFamily: tokens.typography.fontFamily.sans,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <Icon size={15} strokeWidth={2} />
                            {label}
                            {!enabled && (
                                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>bald</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {!schedule ? (
                <p style={{ color: tokens.colors.text.tertiary, fontSize: 13, padding: "0 12px" }}>
                    Routine wird geladen…
                </p>
            ) : (
                <>
                    {/* ── Aufwachzeit-Karte ── */}
                    <div
                        style={{
                            ...tokens.glass.card,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Sunrise size={20} strokeWidth={2} style={{ color: accent }} />
                            <div>
                                <div style={{
                                    fontFamily: tokens.typography.fontFamily.sans,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.text.primary,
                                }}>
                                    Aufwachzeit
                                </div>
                                <div style={{ fontSize: 11.5, color: tokens.colors.text.tertiary }}>
                                    Alle Zeiten passen sich automatisch an
                                </div>
                            </div>
                        </div>
                        <input
                            type="time"
                            value={schedule.wakeTime}
                            onChange={(e) => setWakeTime(e.target.value)}
                            style={{
                                ...tokens.glass.input,
                                padding: "8px 12px",
                                fontFamily: tokens.typography.fontFamily.mono,
                                fontSize: 16,
                                fontWeight: 600,
                                color: accent,
                                fontVariantNumeric: "tabular-nums",
                                colorScheme: mode === "dark" ? "dark" : "light",
                            }}
                        />
                    </div>

                    {/* ── Spezialregeln ── */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                        {schedule.rules.map((r) => {
                            const mondayOnly = r.mode === "mondayUntil";
                            const dim = mondayOnly && !isMonday;
                            const text =
                                r.mode === "from"
                                    ? `${r.label} ab ${r.time} Uhr`
                                    : r.mode === "mondayUntil"
                                    ? `Montags ${r.label} bis ${r.time} Uhr`
                                    : `${r.label} bis ${r.time} Uhr`;
                            return (
                                <div
                                    key={r.id}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 11px",
                                        borderRadius: tokens.radius.pill,
                                        background: dim ? "transparent" : tokens.colors.accent.softer,
                                        border: `0.5px solid ${mondayOnly && isMonday ? accent : tokens.colors.border.glass}`,
                                        fontSize: 12,
                                        color: dim ? tokens.colors.text.tertiary : tokens.colors.text.secondary,
                                        opacity: dim ? 0.6 : 1,
                                    }}
                                >
                                    <span style={{ fontSize: 13 }}>{r.emoji}</span>
                                    {text}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Timeline ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {schedule.steps.map((s) => {
                            const cat = categoryColor(s.category, tokens);
                            return (
                                <div
                                    key={s.id}
                                    style={{
                                        ...tokens.glass.card,
                                        padding: "12px 14px",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 12,
                                    }}
                                >
                                    {/* Startzeit */}
                                    <div style={{ minWidth: 46, textAlign: "right", flexShrink: 0, paddingTop: 1 }}>
                                        <div style={{
                                            fontFamily: tokens.typography.fontFamily.mono,
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: tokens.colors.text.primary,
                                            fontVariantNumeric: "tabular-nums",
                                            letterSpacing: "-0.5px",
                                        }}>
                                            {s.startTime}
                                        </div>
                                        {s.duration > 0 && (
                                            <div style={{ fontSize: 10.5, color: tokens.colors.text.tertiary }}>
                                                {s.duration} Min
                                            </div>
                                        )}
                                    </div>

                                    {/* Kategorie-Balken */}
                                    <div style={{
                                        width: 3,
                                        alignSelf: "stretch",
                                        borderRadius: 2,
                                        background: cat,
                                        flexShrink: 0,
                                        opacity: 0.7,
                                    }} />

                                    {/* Inhalt */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontFamily: tokens.typography.fontFamily.sans,
                                            fontWeight: tokens.typography.fontWeight.semibold,
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.text.primary,
                                            lineHeight: 1.35,
                                        }}>
                                            {s.label}
                                        </div>
                                        {s.note && (
                                            <div style={{
                                                fontSize: 12,
                                                color: tokens.colors.text.secondary,
                                                marginTop: 2,
                                                lineHeight: 1.4,
                                            }}>
                                                {s.note}
                                            </div>
                                        )}
                                    </div>

                                    {/* Kategorie-Label */}
                                    <span style={{
                                        flexShrink: 0,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        color: cat,
                                        background: `${cat}1a`,
                                        padding: "3px 8px",
                                        borderRadius: tokens.radius.pill,
                                    }}>
                                        {s.category}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer: Fertig + Gesamtdauer ── */}
                    <div
                        style={{
                            ...tokens.glass.cardStrong,
                            marginTop: 12,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <CheckCircle2 size={20} strokeWidth={2} style={{ color: accent }} />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontFamily: tokens.typography.fontFamily.sans,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.text.primary,
                            }}>
                                Fertig um {schedule.endTime} Uhr
                            </div>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11.5,
                                color: tokens.colors.text.tertiary,
                                marginTop: 2,
                            }}>
                                <Clock size={11} /> Gesamtdauer {schedule.totalDuration} Min
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
