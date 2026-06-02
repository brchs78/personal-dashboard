// OLE OS — Sidebar
// Schmale Icon-Navigation links. Glassmorphism über Navy-Background.
// Aktiver Tab: Gold-Akzent (animierter linker Balken + Icon-Color).
// Subtile Scale-Animationen via framer-motion.

import { motion } from "framer-motion";
import {
    LayoutDashboard,
    CalendarDays,
    Dumbbell,
    Activity,
    ListTodo,
    Flame,
    GraduationCap,
    Settings,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme.jsx";

const SIDEBAR_WIDTH = 64;
const ICON_SIZE = 20;
const BUTTON_SIZE = 44;

const NAV_ITEMS = [
    { id: "dash", icon: LayoutDashboard, label: "Home" },
    { id: "cal", icon: CalendarDays, label: "Calendar" },
    { id: "training", icon: Dumbbell, label: "Training" },
    { id: "health", icon: Activity, label: "Health" },
    { id: "todo", icon: ListTodo, label: "ToDo" },
    { id: "habit", icon: Flame, label: "Habits" },
    { id: "uni", icon: GraduationCap, label: "Uni" },
];

export default function Sidebar({ activeTab, onTabChange }) {
    const { tokens } = useTheme();
    return (
        <aside
            style={{
                width: SIDEBAR_WIDTH,
                height: "100vh",
                background: tokens.colors.bg.elevated,
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
    const { tokens } = useTheme();
    return (
        <div
            style={{
                width: 36,
                height: 36,
                borderRadius: tokens.radius.lg,
                background: tokens.colors.accent.DEFAULT,
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
    const { tokens } = useTheme();
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
