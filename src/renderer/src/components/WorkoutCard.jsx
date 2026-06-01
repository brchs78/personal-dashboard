// OLE OS — WorkoutCard
// Atom-Komponente für die Dashboard-Workouts.
// Glassmorphism-Karte, Gold-Akzent auf der Dauer-Zahl, Status-Badge oben rechts.

import { motion } from "framer-motion";
import {
    Footprints,
    Mountain,
    Zap,
    Timer,
    Coffee,
    Check,
    Circle,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";

// Mapping Workout-Typ → lucide-Icon
function getTypeIcon(type) {
    const t = (type || "").toLowerCase();
    if (t.includes("rest") || t.includes("ruhe") || t.includes("pause")) return Coffee;
    if (t.includes("tempo") || t.includes("schwelle")) return Zap;
    if (t.includes("interval")) return Timer;
    if (t.includes("long") || t.includes("lang")) return Mountain;
    return Footprints;
}

/**
 * @param {object} props
 * @param {string} props.type           — z. B. "Easy Run", "Tempo", "Long Run", "Intervalle", "Ruhetag"
 * @param {number} props.duration       — Minuten
 * @param {number} [props.zone]         — HR-Zone 1–5 (optional, alt. zu pace)
 * @param {string} [props.pace]         — Pace-String, z. B. "5:30/km" (optional, alt. zu zone)
 * @param {"done"|"open"} [props.status="open"]
 * @param {() => void} [props.onClick]  — optional, macht die Karte interaktiv
 */
export default function WorkoutCard({
    type,
    duration,
    zone,
    pace,
    status = "open",
    onClick,
}) {
    const { tokens } = useTheme();
    const Icon = getTypeIcon(type);
    const isDone = status === "done";
    const interactive = typeof onClick === "function";

    // Zone X · 5:30/km — beides optional, nur das, was gesetzt ist
    const meta = [zone != null ? `Zone ${zone}` : null, pace || null]
        .filter(Boolean)
        .join(" · ");

    return (
        <motion.div
            onClick={onClick}
            whileHover={interactive ? { y: -2 } : undefined}
            whileTap={interactive ? { scale: 0.98 } : undefined}
            transition={tokens.motion.spring.snappy}
            style={{
                // Glass-Base aus dem Design-System
                ...tokens.glass.card,
                padding: tokens.spacing.lg,
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacing.md,
                cursor: interactive ? "pointer" : "default",
                opacity: isDone ? 0.7 : 1,
                position: "relative",
                // Done-State: Gold-Border links statt Standard-Glass-Border
                borderLeft: isDone
                    ? `2px solid ${tokens.colors.accent.DEFAULT}`
                    : tokens.glass.card.border,
            }}
        >
            {/* Header: Icon + Typ-Label · Status-Badge */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: tokens.spacing.md,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: tokens.spacing.sm,
                        minWidth: 0,
                    }}
                >
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: tokens.radius.sm,
                            background: tokens.colors.surface.glass,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon
                            size={16}
                            strokeWidth={2}
                            color={tokens.colors.text.primary}
                        />
                    </div>
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.md,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.text.primary,
                            letterSpacing: tokens.typography.letterSpacing.tight,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {type}
                    </span>
                </div>
                <StatusBadge isDone={isDone} />
            </div>

            {/* Hero-Zahl: Dauer in Gold */}
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: tokens.spacing.xs,
                }}
            >
                <span
                    style={{
                        fontFamily: tokens.typography.fontFamily.display,
                        fontSize: tokens.typography.fontSize["3xl"],
                        fontWeight: tokens.typography.fontWeight.bold,
                        color: tokens.colors.accent.DEFAULT,
                        letterSpacing: tokens.typography.letterSpacing.tight,
                        lineHeight: tokens.typography.lineHeight.tight,
                    }}
                >
                    {duration}
                </span>
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.text.tertiary,
                        textTransform: "uppercase",
                        letterSpacing: tokens.typography.letterSpacing.wide,
                    }}
                >
                    min
                </span>
            </div>

            {/* Meta: Zone · Pace */}
            {meta && (
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.text.secondary,
                    }}
                >
                    {meta}
                </div>
            )}
        </motion.div>
    );
}

// ──────────────────────────────────────────────────────────────────
// StatusBadge — Pill oben rechts, „Erledigt" oder „Offen"
// ──────────────────────────────────────────────────────────────────
function StatusBadge({ isDone }) {
    const { tokens } = useTheme();
    const baseStyle = {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: tokens.radius.full,
        fontSize: tokens.typography.fontSize.xs,
        fontWeight: tokens.typography.fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: tokens.typography.letterSpacing.wide,
        flexShrink: 0,
    };

    if (isDone) {
        return (
            <span
                style={{
                    ...baseStyle,
                    background: tokens.colors.accent.soft,
                    border: `1px solid ${tokens.colors.accent.border}`,
                    color: tokens.colors.accent.DEFAULT,
                }}
            >
                <Check size={12} strokeWidth={3} />
                Erledigt
            </span>
        );
    }
    return (
        <span
            style={{
                ...baseStyle,
                background: "transparent",
                border: `1px solid ${tokens.colors.border.glass}`,
                color: tokens.colors.text.secondary,
            }}
        >
            <Circle size={8} strokeWidth={3} />
            Offen
        </span>
    );
}
