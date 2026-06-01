// OLE OS — MarathonCountdown
// Kompakter Countdown bis zum Marathon (Default: München, 11.10.2026).
// Bewusst klein gehalten — Workouts haben Dashboard-Priorität.

import { Flag } from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";

const DEFAULT_TARGET = "2026-10-11";
const DEFAULT_LOCATION = "München";

// Tage bis Ziel-Datum (ISO yyyy-mm-dd), 0 wenn vergangen.
function daysUntil(iso) {
    const target = new Date(iso + "T00:00:00");
    const now = new Date();
    const ms = target.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / 86400000));
}

/**
 * @param {object} props
 * @param {string} [props.targetDate="2026-10-11"] — ISO yyyy-mm-dd
 * @param {string} [props.location="München"]
 */
export default function MarathonCountdown({
    targetDate = DEFAULT_TARGET,
    location = DEFAULT_LOCATION,
}) {
    const { tokens } = useTheme();
    const days = daysUntil(targetDate);
    const dateLabel = new Date(targetDate + "T00:00:00").toLocaleDateString(
        "de-DE",
        { day: "2-digit", month: "2-digit", year: "numeric" }
    );

    return (
        <div
            style={{
                ...tokens.glass.card,
                padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                display: "flex",
                alignItems: "center",
                gap: tokens.spacing.lg,
            }}
        >
            {/* Gold-getintete Flag-Box (Akzent ohne zu dominieren) */}
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.sm,
                    background: tokens.colors.accent.soft,
                    border: `1px solid ${tokens.colors.accent.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Flag
                    size={18}
                    strokeWidth={2}
                    color={tokens.colors.accent.DEFAULT}
                />
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 0,
                }}
            >
                {/* Gold-Zahl + "Tage" */}
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
                            fontSize: tokens.typography.fontSize["2xl"],
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.accent.DEFAULT,
                            letterSpacing:
                                tokens.typography.letterSpacing.tight,
                            lineHeight: 1,
                        }}
                    >
                        {days}
                    </span>
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.text.secondary,
                            textTransform: "uppercase",
                            letterSpacing:
                                tokens.typography.letterSpacing.wide,
                        }}
                    >
                        {days === 1 ? "Tag" : "Tage"}
                    </span>
                </div>

                {/* Sub-Label: Location · Datum */}
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.text.tertiary,
                        letterSpacing: tokens.typography.letterSpacing.wide,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {location} · {dateLabel}
                </div>
            </div>
        </div>
    );
}
