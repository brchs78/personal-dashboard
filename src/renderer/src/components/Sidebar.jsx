// OLE OS — Sidebar
// Schmale Icon-Navigation links. Glassmorphism über Navy-Background.
// Aktiver Tab: Gold-Akzent (animierter linker Balken + Icon-Color).
// Subtile Scale-Animationen via framer-motion.

import { motion } from "framer-motion";
import {
    LayoutDashboard,
    Dumbbell,
    CalendarDays,
    Activity,
    GraduationCap,
    MessageSquare,
    Settings,
} from "lucide-react";
import tokens from "../styles/tokens";

const SIDEBAR_WIDTH = 64;
const ICON_SIZE = 20;
const BUTTON_SIZE = 44;

const NAV_ITEMS = [
    { id: "dash", icon: LayoutDashboard, label: "Dashboard" },
    { id: "workout", icon: Dumbbell, label: "Workout" },
    { id: "plan", icon: CalendarDays, label: "Plan" },
    { id: "health", icon: Activity, label: "Health" },
    { id: "uni", icon: GraduationCap, label: "Uni" },
    { id: "coach", icon: MessageSquare, label: "Coach" },
];

export default function Sidebar({ activeTab, onTabChange }) {
    return (
        <aside
            style={{
                width: SIDEBAR_WIDTH,
                height: "100vh",
                background: tokens.colors.bg.elevated,
                backdropFilter: "blur(20px) saturate(140%)",
                WebkitBackdropFilter: "blur(20px) saturate(140%)",
                borderRight: `1px solid ${tokens.colors.border.glass}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: `${tokens.spacing.lg} 0`,
                gap: tokens.spacing.sm,
                position: "relative",
                // macOS-Window-Drag: oberer Bereich draggable, Buttons heben das auf
                WebkitAppRegion: "drag",
            }}
        >
            {/* Logo */}
            <Logo />

            {/* Primary Nav */}
            <nav
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: tokens.spacing.sm,
                    marginTop: tokens.spacing.lg,
                    WebkitAppRegion: "no-drag",
                }}
            >
                {NAV_ITEMS.map((item) => (
                    <NavButton
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activeTab === item.id}
                        onClick={() => onTabChange(item.id)}
                    />
                ))}
            </nav>

            {/* Spacer pusht Settings ans untere Ende */}
            <div style={{ flex: 1 }} />

            {/* Settings (unten) */}
            <div style={{ WebkitAppRegion: "no-drag" }}>
                <NavButton
                    icon={Settings}
                    label="Settings"
                    isActive={activeTab === "settings"}
                    onClick={() => onTabChange("settings")}
                />
            </div>
        </aside>
    );
}

// ──────────────────────────────────────────────────────────────────
// Logo — kleines "O" mit Gold-Tint
// ──────────────────────────────────────────────────────────────────
function Logo() {
    return (
        <div
            style={{
                width: 36,
                height: 36,
                borderRadius: tokens.radius.md,
                background: `linear-gradient(135deg, ${tokens.colors.accent.DEFAULT} 0%, ${tokens.colors.accent.pressed} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: tokens.typography.fontFamily.display,
                fontSize: 18,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.inverse,
                letterSpacing: tokens.typography.letterSpacing.tight,
                boxShadow: tokens.shadow.glow,
                userSelect: "none",
                WebkitAppRegion: "no-drag",
            }}
        >
            O
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────
// NavButton — Icon-Button mit Active-State + Hover/Tap-Animation
// ──────────────────────────────────────────────────────────────────
function NavButton({ icon: Icon, label, isActive, onClick }) {
    return (
        <motion.button
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={onClick}
            // Subtile Scale-Animation: leicht größer bei Hover, kurz schrumpfen beim Klick
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={tokens.motion.spring.snappy}
            style={{
                position: "relative",
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: tokens.radius.md,
                background: isActive
                    ? tokens.colors.accent.soft
                    : "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                // Hover-Tint kommt aus pseudo-styles — hier mit Inline-Übergang
                transition: `background ${tokens.motion.duration.fast}s ease`,
                WebkitAppRegion: "no-drag",
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    e.currentTarget.style.background =
                        tokens.colors.surface.glassHover;
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                }
            }}
        >
            {/* Gold-Akzent-Balken links beim aktiven Tab (animiert zwischen Tabs) */}
            {isActive && (
                <motion.div
                    layoutId="sidebar-active-bar"
                    transition={tokens.motion.spring.base}
                    style={{
                        position: "absolute",
                        left: -10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: 22,
                        background: tokens.colors.accent.DEFAULT,
                        borderRadius: "0 2px 2px 0",
                        boxShadow: tokens.shadow.glow,
                    }}
                />
            )}

            <Icon
                size={ICON_SIZE}
                strokeWidth={2}
                color={
                    isActive
                        ? tokens.colors.accent.DEFAULT
                        : tokens.colors.text.secondary
                }
            />
        </motion.button>
    );
}
