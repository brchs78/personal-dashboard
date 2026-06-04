// OLE OS — Routine Hub (Morgen-/Abendroutine)
// Zeigt die Routine als Timeline mit dynamisch berechneten Zeiten.
// Morgen: vorwärts ab Aufwachzeit. Abend: rückwärts von Schlafenszeit.
// Edit-Modus: Schritte bearbeiten (Name, Länge, Kategorie, Notiz), hinzufügen, löschen.
import { useState } from "react";
import { Sunrise, Moon, Clock, CheckCircle2, Pencil, Check, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";
import { useRoutine, computeSchedule } from "../hooks/useRoutine.js";

const CATEGORY_OPTIONS = ["Routine", "Körper", "Ernährung", "Mentales", "Pflege", "Lernen"];

function newId() {
    return (typeof window !== "undefined" && window.crypto?.randomUUID)
        ? window.crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Kategorie → Tint (über Tokens, kein hartes Farbschema).
function categoryColor(category, tokens) {
    switch (category) {
        case "Körper":    return tokens.colors.tab.workout;
        case "Ernährung": return tokens.colors.status.success;
        case "Mentales":  return tokens.colors.accent.secondary;
        case "Pflege":    return tokens.colors.status.info;
        case "Lernen":    return tokens.colors.tab.calendar;
        case "Routine":
        default:          return tokens.colors.tab.uni;
    }
}

// Text für eine Spezialregel je nach mode.
function ruleText(r) {
    switch (r.mode) {
        case "from":
        case "fromStart":   return `${r.label} ab ${r.time} Uhr`;
        case "mondayUntil": return `Montags ${r.label} bis ${r.time} Uhr`;
        case "static":      return r.label;
        case "fixed":       return `${r.label} nach ${r.time} Uhr`;
        default:            return `${r.label} bis ${r.time} Uhr`;
    }
}

const ROUTINE_TABS = [
    { id: "morning", label: "Morgen", icon: Sunrise, enabled: true },
    { id: "evening", label: "Abend", icon: Moon, enabled: true },
];

// Pro Routine: Icon und Label für den Ankerzeit-Picker.
const ANCHOR_META = {
    morning: { icon: Sunrise, label: "Aufwachzeit",   hint: "Alle Zeiten passen sich automatisch an" },
    evening: { icon: Moon,    label: "Schlafenszeit", hint: "Zeiten werden rückwärts berechnet" },
};

// Footer-Label je Routine.
const FOOTER_LABEL = {
    morning: (time) => `Fertig um ${time} Uhr`,
    evening: (time) => `Licht aus um ${time} Uhr`,
};

export default function RoutineHub() {
    const { tokens, mode } = useTheme();
    const [activeId, setActiveId] = useState("morning");
    const { schedule, setWakeTime, updateSteps } = useRoutine(activeId);
    const accent = tokens.colors.tab.routine;

    // Edit-Modus + lokaler Entwurf (kein Disk-Write pro Tastendruck).
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);

    const isMonday = new Date().getDay() === 1;
    const anchorMeta = ANCHOR_META[activeId] ?? ANCHOR_META.morning;
    const AnchorIcon = anchorMeta.icon;

    // Live-Vorschau der Zeiten während des Editierens.
    const editSchedule = (editing && draft && schedule)
        ? computeSchedule({ direction: schedule.direction, wakeTime: schedule.wakeTime, steps: draft }, activeId)
        : null;
    const view = editSchedule || schedule;

    function startEdit() {
        if (!schedule) return;
        setDraft(schedule.steps.map(({ id, label, duration, category, note }) => ({ id, label, duration, category, note })));
        setEditing(true);
    }
    function finishEdit() {
        if (draft) updateSteps(draft);
        setDraft(null);
        setEditing(false);
    }
    function switchTab(id) {
        if (editing) finishEdit();
        setActiveId(id);
    }
    function patchDraft(id, patch) {
        setDraft((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    }
    function removeDraft(id) {
        setDraft((d) => d.filter((s) => s.id !== id));
    }
    function addDraft() {
        setDraft((d) => [...d, { id: newId(), label: "Neuer Schritt", duration: 5, category: "Routine", note: "" }]);
    }

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
            {/* ── Header: Routine-Switch + Edit-Toggle ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                {ROUTINE_TABS.map(({ id, label, icon: Icon }) => {
                    const active = id === activeId;
                    return (
                        <button
                            key={id}
                            onClick={() => switchTab(id)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                padding: "8px 14px",
                                borderRadius: tokens.radius.pill,
                                border: `0.5px solid ${active ? accent : tokens.colors.border.glass}`,
                                background: active ? `${accent}1a` : "transparent",
                                color: active ? accent : tokens.colors.text.secondary,
                                cursor: "pointer",
                                fontFamily: tokens.typography.fontFamily.sans,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <Icon size={15} strokeWidth={2} />
                            {label}
                        </button>
                    );
                })}

                <div style={{ flex: 1 }} />

                <button
                    onClick={() => (editing ? finishEdit() : startEdit())}
                    disabled={!schedule}
                    title={editing ? "Bearbeitung abschließen" : "Routine bearbeiten"}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "8px 14px",
                        borderRadius: tokens.radius.pill,
                        border: `0.5px solid ${editing ? accent : tokens.colors.border.glass}`,
                        background: editing ? `${accent}1a` : "transparent",
                        color: editing ? accent : tokens.colors.text.secondary,
                        cursor: schedule ? "pointer" : "not-allowed",
                        opacity: schedule ? 1 : 0.45,
                        fontFamily: tokens.typography.fontFamily.sans,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        fontSize: tokens.typography.fontSize.sm,
                    }}
                >
                    {editing ? <Check size={15} strokeWidth={2} /> : <Pencil size={15} strokeWidth={2} />}
                    {editing ? "Fertig" : "Bearbeiten"}
                </button>
            </div>

            {!view ? (
                <p style={{ color: tokens.colors.text.tertiary, fontSize: 13, padding: "0 12px" }}>
                    Routine wird geladen…
                </p>
            ) : (
                <>
                    {/* ── Ankerzeit-Karte (Aufwachzeit / Schlafenszeit) ── */}
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
                            <AnchorIcon size={20} strokeWidth={2} style={{ color: accent }} />
                            <div>
                                <div style={{
                                    fontFamily: tokens.typography.fontFamily.sans,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.text.primary,
                                }}>
                                    {anchorMeta.label}
                                </div>
                                <div style={{ fontSize: 11.5, color: tokens.colors.text.tertiary }}>
                                    {anchorMeta.hint}
                                </div>
                            </div>
                        </div>
                        <input
                            type="time"
                            value={view.wakeTime}
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
                        {view.rules.map((r) => {
                            const mondayOnly = r.mode === "mondayUntil";
                            const dim = mondayOnly && !isMonday;
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
                                    {ruleText(r)}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Timeline ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {view.steps.map((s) => {
                            const cat = categoryColor(s.category, tokens);
                            return editing ? (
                                <StepEditRow
                                    key={s.id}
                                    step={s}
                                    cat={cat}
                                    tokens={tokens}
                                    onPatch={(patch) => patchDraft(s.id, patch)}
                                    onRemove={() => removeDraft(s.id)}
                                />
                            ) : (
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

                    {/* ── „+ Schritt hinzufügen" (nur im Edit-Modus) ── */}
                    {editing && (
                        <button
                            onClick={addDraft}
                            style={{
                                marginTop: 8,
                                width: "100%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "12px 14px",
                                borderRadius: tokens.radius.lg,
                                border: `1px dashed ${tokens.colors.border.glass}`,
                                background: "transparent",
                                color: accent,
                                cursor: "pointer",
                                fontFamily: tokens.typography.fontFamily.sans,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <Plus size={16} strokeWidth={2.2} />
                            Schritt hinzufügen
                        </button>
                    )}

                    {/* ── Footer: Ende + Gesamtdauer ── */}
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
                                {(FOOTER_LABEL[activeId] ?? FOOTER_LABEL.morning)(view.endTime)}
                            </div>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11.5,
                                color: tokens.colors.text.tertiary,
                                marginTop: 2,
                            }}>
                                <Clock size={11} /> Gesamtdauer {view.totalDuration} Min
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// StepEditRow — editierbare Zeile (Name, Länge, Kategorie, Notiz, Löschen)
// ──────────────────────────────────────────────────────────────────
function StepEditRow({ step, cat, tokens, onPatch, onRemove }) {
    const inputBase = {
        ...tokens.glass.input,
        padding: "7px 10px",
        fontFamily: tokens.typography.fontFamily.sans,
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.text.primary,
        colorScheme: undefined,
    };
    return (
        <div
            style={{
                ...tokens.glass.card,
                padding: "10px 12px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
            }}
        >
            {/* Berechnete Startzeit (read-only) */}
            <div style={{ minWidth: 46, textAlign: "right", flexShrink: 0, paddingTop: 8 }}>
                <div style={{
                    fontFamily: tokens.typography.fontFamily.mono,
                    fontSize: 15,
                    fontWeight: 700,
                    color: tokens.colors.text.primary,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.5px",
                }}>
                    {step.startTime}
                </div>
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

            {/* Editierfelder */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                    <input
                        value={step.label}
                        onChange={(e) => onPatch({ label: e.target.value })}
                        placeholder="Bezeichnung"
                        style={{ ...inputBase, flex: 1, fontWeight: tokens.typography.fontWeight.semibold }}
                    />
                    <button
                        onClick={onRemove}
                        title="Schritt entfernen"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 34,
                            flexShrink: 0,
                            borderRadius: tokens.radius.md,
                            border: `0.5px solid ${tokens.colors.border.glass}`,
                            background: "transparent",
                            color: tokens.colors.status.danger,
                            cursor: "pointer",
                        }}
                    >
                        <Trash2 size={15} strokeWidth={2} />
                    </button>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                        type="number"
                        min="0"
                        value={step.duration}
                        onChange={(e) => onPatch({ duration: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        style={{ ...inputBase, width: 64, fontVariantNumeric: "tabular-nums" }}
                    />
                    <span style={{ fontSize: 11.5, color: tokens.colors.text.tertiary }}>Min</span>
                    <select
                        value={step.category}
                        onChange={(e) => onPatch({ category: e.target.value })}
                        style={{ ...inputBase, flex: 1, cursor: "pointer" }}
                    >
                        {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <input
                    value={step.note}
                    onChange={(e) => onPatch({ note: e.target.value })}
                    placeholder="Notiz (optional)"
                    style={{ ...inputBase, fontSize: 12, color: tokens.colors.text.secondary }}
                />
            </div>
        </div>
    );
}
