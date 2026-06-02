// OLE OS — Habit Tracker Hub (Atomic Habits / 1%-Methode)
import { useState, useCallback } from "react";
import { Plus, Flame, Trash2, Check, Pencil } from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";
import { useHabits } from "../hooks/useHabits.js";

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

// Build last 21 dates ending today
function last21Days() {
    const days = [];
    for (let i = 20; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

const CATEGORIES = [
    { value: "mindset", label: "Mindset" },
    { value: "health", label: "Gesundheit" },
    { value: "productivity", label: "Produktivität" },
    { value: "fitness", label: "Fitness" },
];

// ─── DotGrid ────────────────────────────────────────────────────────────────
function DotGrid({ habitId, checkins, tokens }) {
    const days = last21Days();
    const today = todayISO();
    return (
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {days.map((date) => {
                const done = Array.isArray(checkins[date]) && checkins[date].includes(habitId);
                const isToday = date === today;
                return (
                    <div
                        key={date}
                        title={date}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: done ? tokens.colors.accent.DEFAULT : "transparent",
                            border: isToday
                                ? `1.5px solid ${tokens.colors.accent.DEFAULT}`
                                : done
                                    ? "none"
                                    : `1px solid ${tokens.colors.border.subtle}`,
                            opacity: done ? 1 : isToday ? 0.7 : 0.4,
                            transition: "background 0.2s",
                        }}
                    />
                );
            })}
        </div>
    );
}

// ─── HabitCard ──────────────────────────────────────────────────────────────
function HabitCard({ habit, checkins, streak, onToggle, onRemove, onEdit, tokens }) {
    const [hovered, setHovered] = useState(false);
    const today = todayISO();
    const done = Array.isArray(checkins[today]) && checkins[today].includes(habit.id);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                ...tokens.glass.card,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                position: "relative",
                transition: "box-shadow 0.15s",
            }}
        >
            {/* Top row: emoji + name + streak + checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{habit.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontFamily: tokens.typography.fontFamily.sans,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.text.primary,
                        lineHeight: 1.2,
                    }}>
                        {habit.name}
                    </div>
                    {habit.identity && (
                        <div style={{
                            fontFamily: tokens.typography.fontFamily.serif,
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.text.tertiary,
                            marginTop: 2,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {habit.identity}
                        </div>
                    )}
                </div>

                {/* Streak badge */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: tokens.radius.pill,
                    background: streak > 0 ? tokens.colors.accent.soft : "transparent",
                    border: `1px solid ${streak > 0 ? tokens.colors.accent.border : tokens.colors.border.subtle}`,
                    flexShrink: 0,
                }}>
                    <span style={{ fontSize: 11 }}>{streak > 0 ? "🔥" : "○"}</span>
                    <span style={{
                        fontFamily: tokens.typography.fontFamily.sans,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: streak > 0 ? tokens.colors.accent.DEFAULT : tokens.colors.text.tertiary,
                    }}>
                        {streak}
                    </span>
                </div>

                {/* Today checkbox */}
                <button
                    onClick={() => onToggle(habit.id)}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: `2px solid ${done ? tokens.colors.accent.DEFAULT : tokens.colors.border.glass}`,
                        background: done ? tokens.colors.accent.DEFAULT : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s",
                    }}
                >
                    {done && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
            </div>

            {/* 21-day dot grid */}
            <DotGrid habitId={habit.id} checkins={checkins} tokens={tokens} />

            {/* Two-minute version hint */}
            {habit.twoMinuteVersion && (
                <div style={{
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.tertiary,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                }}>
                    <span style={{ opacity: 0.6 }}>2 min →</span> {habit.twoMinuteVersion}
                </div>
            )}

            {/* Edit + Trash on hover */}
            {hovered && (
                <div style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    display: "flex",
                    gap: 2,
                }}>
                    <button
                        onClick={() => onEdit(habit)}
                        title="Habit bearbeiten"
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: tokens.radius.sm,
                            color: tokens.colors.text.tertiary,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        onClick={() => onRemove(habit.id)}
                        title="Habit entfernen"
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            borderRadius: tokens.radius.sm,
                            color: tokens.colors.text.tertiary,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── HabitModal (Add + Edit) ─────────────────────────────────────────────────
function HabitModal({ onClose, onSave, tokens, initial }) {
    const isEdit = Boolean(initial);
    const [form, setForm] = useState({
        name: initial?.name || "",
        emoji: initial?.emoji || "✅",
        identity: initial?.identity || "",
        twoMinuteVersion: initial?.twoMinuteVersion || "",
        category: initial?.category || "mindset",
    });

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const handleSave = () => {
        if (!form.name.trim()) return;
        onSave(form);
        onClose();
    };

    const inputStyle = {
        width: "100%",
        padding: "8px 12px",
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.border.glass}`,
        background: tokens.colors.bg.sunken,
        color: tokens.colors.text.primary,
        fontFamily: tokens.typography.fontFamily.sans,
        fontSize: tokens.typography.fontSize.sm,
        outline: "none",
        boxSizing: "border-box",
    };

    const labelStyle = {
        fontFamily: tokens.typography.fontFamily.sans,
        fontSize: tokens.typography.fontSize.xs,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.text.secondary,
        marginBottom: 4,
        display: "block",
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    ...tokens.glass.modalCard,
                    width: 360,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                }}
            >
                <h3 style={{
                    margin: 0,
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    fontSize: tokens.typography.fontSize.base,
                    color: tokens.colors.text.primary,
                }}>
                    {isEdit ? "Gewohnheit bearbeiten" : "Neue Gewohnheit"}
                </h3>

                {/* Emoji + Name row */}
                <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 60 }}>
                        <label style={labelStyle}>Emoji</label>
                        <input
                            value={form.emoji}
                            onChange={(e) => set("emoji", e.target.value)}
                            style={{ ...inputStyle, textAlign: "center", fontSize: 20 }}
                            maxLength={4}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Name</label>
                        <input
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="z.B. Morgenmeditation"
                            style={inputStyle}
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label style={labelStyle}>Identität ("Ich bin jemand, der…")</label>
                    <input
                        value={form.identity}
                        onChange={(e) => set("identity", e.target.value)}
                        placeholder="…täglich meditiert"
                        style={inputStyle}
                    />
                </div>

                <div>
                    <label style={labelStyle}>Zwei-Minuten-Version (optional)</label>
                    <input
                        value={form.twoMinuteVersion}
                        onChange={(e) => set("twoMinuteVersion", e.target.value)}
                        placeholder="z.B. 1 Atemübung"
                        style={inputStyle}
                    />
                </div>

                <div>
                    <label style={labelStyle}>Kategorie</label>
                    <select
                        value={form.category}
                        onChange={(e) => set("category", e.target.value)}
                        style={inputStyle}
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: "9px 0",
                            borderRadius: tokens.radius.pill,
                            border: `1px solid ${tokens.colors.border.glass}`,
                            background: "transparent",
                            color: tokens.colors.text.secondary,
                            fontFamily: tokens.typography.fontFamily.sans,
                            fontSize: tokens.typography.fontSize.sm,
                            cursor: "pointer",
                        }}
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!form.name.trim()}
                        style={{
                            flex: 1, padding: "9px 0",
                            borderRadius: tokens.radius.pill,
                            border: "none",
                            background: form.name.trim() ? tokens.colors.accent.DEFAULT : tokens.colors.border.subtle,
                            color: form.name.trim() ? "#fff" : tokens.colors.text.tertiary,
                            fontFamily: tokens.typography.fontFamily.sans,
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            cursor: form.name.trim() ? "pointer" : "default",
                        }}
                    >
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd, tokens }) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "60px 24px",
            textAlign: "center",
        }}>
            <div style={{ fontSize: 40 }}>🌱</div>
            <div>
                <div style={{
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    fontSize: tokens.typography.fontSize.base,
                    color: tokens.colors.text.primary,
                    marginBottom: 6,
                }}>
                    Fang klein an
                </div>
                <div style={{
                    fontFamily: tokens.typography.fontFamily.serif,
                    fontStyle: "italic",
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.text.secondary,
                    maxWidth: 260,
                    lineHeight: 1.5,
                }}>
                    "Die 1%-Methode: Eine winzige Verbesserung täglich führt zu 37× besseren Ergebnissen nach einem Jahr."
                </div>
            </div>
            <button
                onClick={onAdd}
                style={{
                    ...tokens.glass.buttonAccent,
                    padding: "10px 24px",
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    cursor: "pointer",
                    border: "none",
                }}
            >
                Erste Gewohnheit anlegen
            </button>
        </div>
    );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({ todayScore, onAdd, tokens }) {
    const { done, total } = todayScore();
    const allDone = total > 0 && done === total;

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 20px 12px",
            flexShrink: 0,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Flame size={18} color={tokens.colors.accent.DEFAULT} />
                <span style={{
                    fontFamily: tokens.typography.fontFamily.sans,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    fontSize: tokens.typography.fontSize.lg,
                    color: tokens.colors.text.primary,
                }}>
                    Habits
                </span>
                {total > 0 && (
                    <span style={{
                        padding: "2px 10px",
                        borderRadius: tokens.radius.pill,
                        background: allDone ? tokens.colors.accent.soft : tokens.colors.bg.card,
                        border: `1px solid ${allDone ? tokens.colors.accent.border : tokens.colors.border.subtle}`,
                        fontFamily: tokens.typography.fontFamily.sans,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: allDone ? tokens.colors.accent.DEFAULT : tokens.colors.text.secondary,
                    }}>
                        {done}/{total} heute {allDone ? "✓" : ""}
                    </span>
                )}
            </div>
            <button
                onClick={onAdd}
                title="Gewohnheit hinzufügen"
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: `1px solid ${tokens.colors.border.glass}`,
                    background: tokens.colors.bg.card,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: tokens.colors.text.secondary,
                }}
            >
                <Plus size={15} />
            </button>
        </div>
    );
}

// ─── HabitHub (main export) ──────────────────────────────────────────────────
export default function HabitHub() {
    const { tokens } = useTheme();
    const { habits, checkins, streaks, addHabit, updateHabit, removeHabit, toggleCheckin, todayScore } = useHabits();
    const [showAdd, setShowAdd] = useState(false);
    const [editingHabit, setEditingHabit] = useState(null);

    const handleAdd = useCallback(async (form) => {
        await addHabit(form);
    }, [addHabit]);

    const handleUpdate = useCallback(async (form) => {
        if (!editingHabit) return;
        await updateHabit(editingHabit.id, form);
    }, [updateHabit, editingHabit]);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: tokens.colors.bg.base,
            overflow: "hidden",
        }}>
            <Header todayScore={todayScore} onAdd={() => setShowAdd(true)} tokens={tokens} />

            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 16px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
            }}>
                {habits.length === 0 ? (
                    <EmptyState onAdd={() => setShowAdd(true)} tokens={tokens} />
                ) : (
                    habits.map((habit) => (
                        <HabitCard
                            key={habit.id}
                            habit={habit}
                            checkins={checkins}
                            streak={streaks[habit.id] || 0}
                            onToggle={toggleCheckin}
                            onRemove={removeHabit}
                            onEdit={setEditingHabit}
                            tokens={tokens}
                        />
                    ))
                )}
            </div>

            {showAdd && (
                <HabitModal
                    tokens={tokens}
                    onClose={() => setShowAdd(false)}
                    onSave={handleAdd}
                />
            )}

            {editingHabit && (
                <HabitModal
                    tokens={tokens}
                    initial={editingHabit}
                    onClose={() => setEditingHabit(null)}
                    onSave={handleUpdate}
                />
            )}
        </div>
    );
}
