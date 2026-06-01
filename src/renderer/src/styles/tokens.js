// OLE OS — Design System Tokens
// Stil: Claude-inspired warm light theme
// Palette: Warm Cream + Coral accent
//
// CommonJS-Export, damit dieselbe Quelle sowohl im Renderer (Vite-CJS-Interop)
// als auch in `tailwind.config.js` per require() nutzbar ist.

// ──────────────────────────────────────────────────────────────────
// COLORS
// ──────────────────────────────────────────────────────────────────
const colors = {
  // Page-Backgrounds (Warm Cream)
  bg: {
    base: "#faf9f5",        // warmes Cream — Page-Background
    elevated: "#ffffff",    // weiße Cards
    sunken: "#f3efe7",      // Drawer, Sidebar, Inputs
  },

  // Card-Surfaces (soft white)
  surface: {
    glass: "rgba(255,255,255,0.80)",
    glassHover: "rgba(255,255,255,0.92)",
    glassActive: "rgba(255,255,255,1.0)",
    glassStrong: "rgba(255,255,255,0.95)",
  },

  // Accent — Coral (Primary) + Warm Taupe (Secondary)
  accent: {
    DEFAULT: "#cc785c",                        // Primary Coral
    hover: "#b8654a",                          // Hover dunkler
    pressed: "#a5573f",                        // Pressed
    soft: "rgba(204,120,92,0.12)",             // Background-Tint
    softer: "rgba(204,120,92,0.06)",           // Sehr dezent
    border: "rgba(204,120,92,0.25)",           // Border für Accent-Karten
    glow: "rgba(204,120,92,0.30)",             // Shadow-Glow
    secondary: "#8b7355",                      // Secondary warm Taupe
    secondaryHover: "#7a6347",
    secondarySoft: "rgba(139,115,85,0.10)",
    gradient: "linear-gradient(135deg,#cc785c,#d4a27f)",          // Coral → Sand
    gradientSoft: "linear-gradient(135deg,rgba(204,120,92,0.12),rgba(212,162,127,0.12))",
  },

  // Text (warm dark)
  text: {
    primary: "#3d3929",                        // Headlines, Body
    secondary: "rgba(61,57,41,0.60)",          // Sublabels
    tertiary: "rgba(61,57,41,0.40)",           // Captions, Metadata
    disabled: "rgba(61,57,41,0.25)",           // Disabled
    inverse: "#ffffff",                        // Text auf Accent-CTA
  },

  // Borders (warm)
  border: {
    glass: "rgba(61,57,41,0.10)",
    glassHover: "rgba(61,57,41,0.16)",
    subtle: "rgba(61,57,41,0.06)",
    strong: "rgba(61,57,41,0.20)",
  },

  // Semantic / Status
  status: {
    success: "#5a8a5e",
    warning: "#b8860b",
    danger: "#c44536",
    info: "#4a7fb5",
  },

  // Tab-Akzente (warm, abgestimmt)
  tab: {
    workout: "#cc785c",     // Coral
    body: "#a67c5a",        // Bronze
    uni: "#8b7355",         // Taupe
    calendar: "#7a6b56",    // Olive
  },
};

// ──────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ──────────────────────────────────────────────────────────────────
const radius = {
  sm: "10px",
  md: "14px",
  lg: "20px",
  xl: "28px",
  "2xl": "32px",
  pill: "999px",
  full: "9999px",
};

// ──────────────────────────────────────────────────────────────────
// BLUR (für backdrop-filter — weniger nötig im Light-Theme)
// ──────────────────────────────────────────────────────────────────
const blur = {
  sm: "10px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  "2xl": "40px",
};

// ──────────────────────────────────────────────────────────────────
// SHADOWS (Warm, weich)
// ──────────────────────────────────────────────────────────────────
const shadow = {
  sm: "0 1px 3px rgba(61,57,41,0.06)",
  card: "0 1px 2px rgba(61,57,41,0.04), 0 4px 12px rgba(61,57,41,0.06)",
  cardHover: "0 2px 4px rgba(61,57,41,0.06), 0 8px 24px rgba(61,57,41,0.08)",
  elevated: "0 4px 16px rgba(61,57,41,0.08), 0 12px 32px rgba(61,57,41,0.06)",
  modal: "0 8px 32px rgba(61,57,41,0.12), 0 24px 64px rgba(61,57,41,0.08)",
  glow: "0 2px 12px rgba(204,120,92,0.25)",
  glowStrong: "0 4px 20px rgba(204,120,92,0.35)",
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
// TYPOGRAPHY (Space Grotesk + Newsreader)
// ──────────────────────────────────────────────────────────────────
const typography = {
  fontFamily: {
    sans: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    serif: "'Newsreader', 'Charter', 'Georgia', serif",
    display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
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
    "4xl": "44px",
    "5xl": "56px",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tighter: "-0.03em",
    tight: "-0.02em",
    normal: "0",
    wide: "0.05em",
    wider: "0.08em",
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
    standard: [0.4, 0, 0.2, 1],
    out: [0, 0, 0.2, 1],
    in: [0.4, 0, 1, 1],
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
// CARD & COMPONENT PRESETS (fertige Style-Objekte)
// ──────────────────────────────────────────────────────────────────
const glass = {
  card: {
    background: colors.bg.elevated,
    border: `1px solid ${colors.border.glass}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },

  cardHover: {
    background: colors.bg.elevated,
    border: `1px solid ${colors.border.glassHover}`,
    borderRadius: radius.lg,
    boxShadow: shadow.cardHover,
  },

  cardStrong: {
    background: colors.bg.elevated,
    border: `1px solid ${colors.border.glassHover}`,
    borderRadius: radius.xl,
    boxShadow: shadow.elevated,
  },

  modal: {
    background: colors.bg.elevated,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radius.xl,
    boxShadow: shadow.modal,
  },

  button: {
    background: colors.bg.sunken,
    border: `1px solid ${colors.border.glass}`,
    borderRadius: radius.pill,
    color: colors.text.primary,
  },

  buttonAccent: {
    background: colors.accent.DEFAULT,
    border: "none",
    borderRadius: radius.pill,
    color: colors.text.inverse,
    boxShadow: shadow.glow,
    fontWeight: typography.fontWeight.semibold,
  },

  input: {
    background: colors.bg.sunken,
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

export {
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
export default tokens;
