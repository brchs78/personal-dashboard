// OLE OS — Dashboard
// Top:    "HEUTE" Section-Header + kompakter Marathon-Countdown (rechts oben)
//         große WorkoutCard für den heutigen Lauf
// Bottom: "Diese Woche" 7-Tage-Mini-Strip mit Gold-Highlight auf Heute
//
// Daten: aktuell Mock (WEEK_PLAN). Wird später durch echten App-State ersetzt.

import { useMemo } from "react";
import { Check, Circle } from "lucide-react";
import WorkoutCard from "./WorkoutCard";
import MarathonCountdown from "./MarathonCountdown";
import tokens from "../styles/tokens";

// ──────────────────────────────────────────────────────────────────
// MOCK-DATEN — typische Marathon-Trainingswoche
// ──────────────────────────────────────────────────────────────────
const WEEK_PLAN = [
    { day: "Mo", type: "Easy Run", duration: 60, zone: 2, status: "done" },
    { day: "Di", type: "Tempo", duration: 45, pace: "4:30/km", status: "done" },
    { day: "Mi", type: "Easy Run", duration: 50, zone: 2, status: "done" },
    { day: "Do", type: "Intervalle", duration: 60, pace: "4:00/km", status: "done" },
    { day: "Fr", type: "Ruhetag", duration: 0, status: "done" },
    { day: "Sa", type: "Easy Run", duration: 40, zone: 2, status: "done" },
    { day: "So", type: "Long Run", duration: 120, zone: 2, status: "open" },
];

// JS Date.getDay() liefert 0=So…6=Sa. Wir wollen 0=Mo…6=So.
function getTodayIndex() {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}

export default function Dashboard() {
    const todayIdx = useMemo(getTodayIndex, []);
    const today = WEEK_PLAN[todayIdx];

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacing.xl,
                padding: tokens.spacing.lg,
                maxWidth: 720,
                margin: "0 auto",
            }}
        >
            {/* HEUTE-Header + Marathon-Pill (rechts) */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: tokens.spacing.lg,
                    flexWrap: "wrap",
                }}
            >
                <SectionHeader>Heute</SectionHeader>
                <MarathonCountdown />
            </div>

            {/* Heutiger Workout — große Karte */}
            <WorkoutCard
                type={today.type}
                duration={today.duration}
                zone={today.zone}
                pace={today.pace}
                status={today.status}
            />

            {/* Wochenplan-Strip */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: tokens.spacing.md,
                }}
            >
                <SectionHeader>Diese Woche</SectionHeader>
                <WeekStrip plan={WEEK_PLAN} todayIdx={todayIdx} />
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// SectionHeader — konsistente H2-Überschrift im Display-Font
// ──────────────────────────────────────────────────────────────────
function SectionHeader({ children }) {
    return (
        <h2
            style={{
                margin: 0,
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                letterSpacing: tokens.typography.letterSpacing.tight,
            }}
        >
            {children}
        </h2>
    );
}

// ──────────────────────────────────────────────────────────────────
// WeekStrip — 7-Spalten-Grid mit Mini-DayTiles
// ──────────────────────────────────────────────────────────────────
function WeekStrip({ plan, todayIdx }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: tokens.spacing.sm,
            }}
        >
            {plan.map((p, i) => (
                <DayTile
                    key={p.day}
                    day={p.day}
                    duration={p.duration}
                    zone={p.zone}
                    pace={p.pace}
                    status={p.status}
                    isToday={i === todayIdx}
                    isRest={p.duration === 0}
                />
            ))}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// DayTile — kompakte Tageskarte
// ──────────────────────────────────────────────────────────────────
function DayTile({ day, duration, zone, pace, status, isToday, isRest }) {
    const isDone = status === "done";
    const StatusIcon = isDone ? Check : Circle;

    // Priorität: today > rest > done > open
    const tileOpacity = isToday ? 1 : isRest ? 0.5 : isDone ? 0.75 : 1;

    return (
        <div
            style={{
                padding: tokens.spacing.sm,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minHeight: 88,
                borderRadius: tokens.radius.md,
                background: isToday
                    ? tokens.colors.accent.soft
                    : tokens.colors.surface.glass,
                backdropFilter: "blur(20px) saturate(140%)",
                WebkitBackdropFilter: "blur(20px) saturate(140%)",
                border: isToday
                    ? `1px solid ${tokens.colors.accent.border}`
                    : `1px solid ${tokens.colors.border.glass}`,
                boxShadow: isToday ? tokens.shadow.glow : tokens.shadow.sm,
                opacity: tileOpacity,
                transition: `background ${tokens.motion.duration.fast}s ease`,
            }}
        >
            {/* Tageskürzel */}
            <div
                style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: isToday
                        ? tokens.colors.accent.DEFAULT
                        : tokens.colors.text.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: tokens.typography.letterSpacing.wide,
                }}
            >
                {day}
            </div>

            {/* Dauer (oder Dash für Ruhetag) */}
            <div
                style={{
                    fontFamily: tokens.typography.fontFamily.display,
                    fontSize: tokens.typography.fontSize.md,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: isToday
                        ? tokens.colors.accent.DEFAULT
                        : tokens.colors.text.primary,
                    lineHeight: 1,
                }}
            >
                {isRest ? "—" : `${duration}'`}
            </div>

            {/* Zone oder Pace (oder leer bei Ruhetag) */}
            <div
                style={{
                    fontSize: 10,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.text.tertiary,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    textTransform: "uppercase",
                    minHeight: 12,
                }}
            >
                {isRest ? "" : zone != null ? `Z${zone}` : pace || ""}
            </div>

            {/* Status-Icon */}
            <div style={{ marginTop: "auto" }}>
                <StatusIcon
                    size={10}
                    strokeWidth={3}
                    color={
                        isDone
                            ? tokens.colors.accent.DEFAULT
                            : tokens.colors.text.tertiary
                    }
                />
            </div>
        </div>
    );
}
