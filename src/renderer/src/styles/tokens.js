// OLE OS — Design System Tokens
// Stil: Premium Glassmorphism (Apple Fitness / macOS Sequoia / visionOS)
// Palette: Navy + Gold
//
// CommonJS-Export, damit dieselbe Quelle sowohl im Renderer (Vite-CJS-Interop)
// als auch in `tailwind.config.js` per require() nutzbar ist.
//
// Verwendung im Renderer:
//   import tokens from "./styles/tokens";
//   <div style={tokens.glass.card} />
//   <div style={{ color: tokens.colors.accent.DEFAULT }} />
//
// Optionale Tailwind-Anbindung (nicht Teil dieses Tasks):
//   const tokens = require("./src/renderer/src/styles/tokens");
//   module.exports = { theme: { extend: { colors: tokens.colors, ... } } }

// ──────────────────────────────────────────────────────────────────
// COLORS
// ──────────────────────────────────────────────────────────────────
const colors = {
  // Page-Backgrounds (Layered Navy)
  bg: {
    base: "#0a0f1e",        // sehr dunkles Navy — Page-Background
    elevated: "#0f1629",    // leicht angehoben — Sidebar, Header-Bar
    sunken: "#060912",      // tiefer — Backdrop unter Modals
  },

  // Glassmorphism-Surfaces (auf bg.base)
  surface: {
    glass: "rgba(255,255,255,0.05)",         // Standard-Karte
    glassHover: "rgba(255,255,255,0.08)",    // Hover-State
    glassActive: "rgba(255,255,255,0.10)",   // Selected / Pressed
    glassStrong: "rgba(255,255,255,0.12)",   // Modal, Floating Toolbar
  },

  // Accent — Gold
  accent: {
    DEFAULT: "#c9a84c",                       // Primary Gold
    hover: "#d8b85c",                         // Hover etwas heller
    pressed: "#b89640",                       // Pressed etwas dunkler
    soft: "rgba(201,168,76,0.12)",            // Background-Tint (Selected Tab)
    softer: "rgba(201,168,76,0.06)",          // Sehr dezent (Hover-Tint)
    border: "rgba(201,168,76,0.30)",          // Border für Gold-Karten
    glow: "rgba(201,168,76,0.40)",            // Shadow-Glow
  },

  // Text
  text: {
    primary: "#ffffff",                       // Headlines, Hero-Zahlen
    secondary: "rgba(255,255,255,0.60)",      // Body, Sublabels
    tertiary: "rgba(255,255,255,0.40)",       // Captions, Metadata
    disabled: "rgba(255,255,255,0.25)",       // Disabled
    inverse: "#0a0f1e",                       // Text auf Gold-CTA
  },

  // Borders
  border: {
    glass: "rgba(255,255,255,0.10)",          // Standard Glassmorphism-Border
    glassHover: "rgba(255,255,255,0.15)",
    subtle: "rgba(255,255,255,0.06)",         // Dividers
    strong: "rgba(255,255,255,0.20)",         // Hervorgehobene Trennlinie
  },

  // Semantic / Status
  status: {
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
    info: "#60a5fa",
  },

  // Tab-Akzente (Workout/Body/Uni/Kalender)
  // Bewusst an Navy-Gold-Theme angepasst — dezenter als die alte SP/UN/BD/KL-Palette
  tab: {
    workout: "#e8a974",     // Warm Coral (statt #fda085)
    body: "#7dd3a1",        // Sage Green (statt #00b894)
    uni: "#b794e6",         // Soft Purple (statt #c471f5)
    calendar: "#7eb6d6",    // Sky Blue (statt #74b9ff)
  },
};

// ──────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ──────────────────────────────────────────────────────────────────
const radius = {
  sm: "8px",                // Tags, kleine Pills
  md: "12px",               // Buttons, Inputs
  lg: "16px",               // Karten (Standard)
  xl: "20px",               // Modals, große Surfaces
  "2xl": "24px",            // Hero-Karten
  full: "9999px",           // Pills, Avatars, Toggle-Switches
};

// ──────────────────────────────────────────────────────────────────
// BLUR (für backdrop-filter)
// ──────────────────────────────────────────────────────────────────
const blur = {
  sm: "10px",
  md: "16px",
  lg: "20px",               // Standard Glassmorphism-Karte
  xl: "28px",               // Modals, starke Trennung
  "2xl": "40px",            // Sehr starke Hintergrund-Unschärfe
};

// ──────────────────────────────────────────────────────────────────
// SHADOWS (Premium — Schwarz weich + Highlight on top)
// ──────────────────────────────────────────────────────────────────
const shadow = {
  sm: "0 2px 8px rgba(0,0,0,0.20)",
  card: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
  cardHover: "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
  elevated: "0 16px 48px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.08)",
  modal: "0 24px 64px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.10)",
  glow: "0 0 20px rgba(201,168,76,0.25)",        // Gold-Glow (CTA)
  glowStrong: "0 0 32px rgba(201,168,76,0.40)",  // Gold-Glow (Hover/Active CTA)
};

// ──────────────────────────────────────────────────────────────────
// SPACING (4px-Grid)
// ──────────────────────────────────────────────────────────────────
const spacing = {
  px: "1px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
  "4xl": "64px",
};

// ──────────────────────────────────────────────────────────────────
// TYPOGRAPHY (Apple-Native-Stack)
// ──────────────────────────────────────────────────────────────────
const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
    display: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    mono: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
  },
  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "15px",
    lg: "17px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "44px",          // Hero-Zahlen (z. B. Marathon-Countdown)
    "5xl": "56px",          // Display
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tighter: "-0.03em",
    tight: "-0.02em",       // Headlines
    normal: "0",
    wide: "0.05em",         // Uppercase Labels
    wider: "0.08em",        // Hero Labels
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.7,
  },
};

// ──────────────────────────────────────────────────────────────────
// MOTION (Framer-Motion-kompatibel)
// ──────────────────────────────────────────────────────────────────
const motion = {
  ease: {
    standard: [0.4, 0, 0.2, 1],     // Material Standard
    out: [0, 0, 0.2, 1],            // Decelerate
    in: [0.4, 0, 1, 1],             // Accelerate
    inOut: [0.4, 0, 0.2, 1],
  },
  spring: {
    soft: { type: "spring", stiffness: 220, damping: 26 },
    base: { type: "spring", stiffness: 380, damping: 30 },
    snappy: { type: "spring", stiffness: 500, damping: 32 },
  },
  duration: {
    fast: 0.15,
    base: 0.25,
    slow: 0.4,
    page: 0.5,
  },
};

// ──────────────────────────────────────────────────────────────────
// GLASSMORPHISM-PRESETS (fertige Style-Objekte für JSX `style={{}}`)
// ──────────────────────────────────────────────────────────────────
const glass = {
  // Standard-Karte (Dashboard-Boxen)
  card: {
    background: colors.surface.glass,
    backdropFilter: "blur(20px) saturate(140%)",
    WebkitBackdropFilter: "blur(20px) saturate(140%)",
    border: `1px solid ${colors.border.glass}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },

  // Hover-Variante (z. B. interaktive Karte)
  cardHover: {
    background: colors.surface.glassHover,
    backdropFilter: "blur(20px) saturate(140%)",
    WebkitBackdropFilter: "blur(20px) saturate(140%)",
    border: `1px solid ${colors.border.glassHover}`,
    borderRadius: radius.lg,
    boxShadow: shadow.cardHover,
  },

  // Stärkere Karte für Modals/Floating-Elemente
  cardStrong: {
    background: colors.surface.glassStrong,
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
    border: `1px solid ${colors.border.glassHover}`,
    borderRadius: radius.xl,
    boxShadow: shadow.elevated,
  },

  // Modal (z. B. Settings-Overlay)
  modal: {
    background: colors.surface.glassStrong,
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radius.xl,
    boxShadow: shadow.modal,
  },

  // Sekundär-Button (Glas-Button)
  button: {
    background: colors.surface.glass,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${colors.border.glass}`,
    borderRadius: radius.md,
    color: colors.text.primary,
  },

  // Primary CTA (Gold)
  buttonAccent: {
    background: colors.accent.DEFAULT,
    border: `1px solid ${colors.accent.hover}`,
    borderRadius: radius.md,
    color: colors.text.inverse,
    boxShadow: shadow.glow,
    fontWeight: typography.fontWeight.semibold,
  },

  // Input
  input: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1px solid ${colors.border.glass}`,
    borderRadius: radius.md,
    color: colors.text.primary,
  },
};

// ──────────────────────────────────────────────────────────────────
// Z-INDEX (Layer-Stack)
// ──────────────────────────────────────────────────────────────────
const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 100,
  overlay: 1000,
  modal: 1100,
  toast: 1200,
  tooltip: 1300,
};

// ──────────────────────────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────────────────────────
const tokens = {
  colors,
  radius,
  blur,
  shadow,
  spacing,
  typography,
  motion,
  glass,
  zIndex,
};

module.exports = tokens;
module.exports.colors = colors;
module.exports.radius = radius;
module.exports.blur = blur;
module.exports.shadow = shadow;
module.exports.spacing = spacing;
module.exports.typography = typography;
module.exports.motion = motion;
module.exports.glass = glass;
module.exports.zIndex = zIndex;
module.exports.default = tokens;
