// OLE OS — Design System Tokens (Light + Dark)
// Palette: Warm Cream/Coral (light) + Deep Navy/Coral (dark)

// ──────────────────────────────────────────────────────────────────
// LIGHT COLORS
// ──────────────────────────────────────────────────────────────────
const lightColors = {
  bg: {
    base: "#faf9f5",
    elevated: "#ffffff",
    sunken: "#f3efe7",
  },
  surface: {
    glass: "rgba(255,255,255,0.80)",
    glassHover: "rgba(255,255,255,0.92)",
    glassActive: "rgba(255,255,255,1.0)",
    glassStrong: "rgba(255,255,255,0.95)",
  },
  accent: {
    DEFAULT: "#cc785c",
    hover: "#b8654a",
    pressed: "#a5573f",
    soft: "rgba(204,120,92,0.12)",
    softer: "rgba(204,120,92,0.06)",
    border: "rgba(204,120,92,0.25)",
    glow: "rgba(204,120,92,0.30)",
    secondary: "#8b7355",
    secondaryHover: "#7a6347",
    secondarySoft: "rgba(139,115,85,0.10)",
    gradient: "linear-gradient(135deg,#cc785c,#d4a27f)",
    gradientSoft: "linear-gradient(135deg,rgba(204,120,92,0.12),rgba(212,162,127,0.12))",
  },
  text: {
    primary: "#3d3929",
    secondary: "rgba(61,57,41,0.60)",
    tertiary: "rgba(61,57,41,0.40)",
    disabled: "rgba(61,57,41,0.25)",
    inverse: "#ffffff",
  },
  border: {
    glass: "rgba(61,57,41,0.10)",
    glassHover: "rgba(61,57,41,0.16)",
    subtle: "rgba(61,57,41,0.06)",
    strong: "rgba(61,57,41,0.20)",
  },
  status: {
    success: "#5a8a5e",
    warning: "#b8860b",
    danger: "#c44536",
    info: "#4a7fb5",
  },
  tab: {
    workout: "#cc785c",
    body: "#a67c5a",
    uni: "#8b7355",
    calendar: "#7a6b56",
  },
};

// ──────────────────────────────────────────────────────────────────
// DARK COLORS
// ──────────────────────────────────────────────────────────────────
const darkColors = {
  bg: {
    base: "#1a1a1a",
    elevated: "#242424",
    sunken: "#111111",
  },
  surface: {
    glass: "rgba(255,255,255,0.06)",
    glassHover: "rgba(255,255,255,0.10)",
    glassActive: "rgba(255,255,255,0.12)",
    glassStrong: "rgba(255,255,255,0.14)",
  },
  accent: {
    DEFAULT: "#d4916e",
    hover: "#e0a07e",
    pressed: "#c07a58",
    soft: "rgba(212,145,110,0.14)",
    softer: "rgba(212,145,110,0.07)",
    border: "rgba(212,145,110,0.30)",
    glow: "rgba(212,145,110,0.35)",
    secondary: "#b89e7e",
    secondaryHover: "#c8ae8e",
    secondarySoft: "rgba(184,158,126,0.12)",
    gradient: "linear-gradient(135deg,#d4916e,#b89e7e)",
    gradientSoft: "linear-gradient(135deg,rgba(212,145,110,0.14),rgba(184,158,126,0.14))",
  },
  text: {
    primary: "#e8e4dc",
    secondary: "rgba(232,228,220,0.60)",
    tertiary: "rgba(232,228,220,0.40)",
    disabled: "rgba(232,228,220,0.25)",
    inverse: "#1a1a1a",
  },
  border: {
    glass: "rgba(255,255,255,0.10)",
    glassHover: "rgba(255,255,255,0.16)",
    subtle: "rgba(255,255,255,0.06)",
    strong: "rgba(255,255,255,0.20)",
  },
  status: {
    success: "#6ebe73",
    warning: "#daa520",
    danger: "#e05545",
    info: "#6a9fd5",
  },
  tab: {
    workout: "#d4916e",
    body: "#c4a07a",
    uni: "#b89e7e",
    calendar: "#a89878",
  },
};

// ──────────────────────────────────────────────────────────────────
// SHARED (mode-independent)
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

const blur = {
  sm: "10px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  "2xl": "40px",
};

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
// BUILD TOKENS FOR A GIVEN MODE
// ──────────────────────────────────────────────────────────────────
function buildTokens(mode) {
  const colors = mode === "dark" ? darkColors : lightColors;

  const shadow = mode === "dark" ? {
    sm: "0 1px 3px rgba(0,0,0,0.20)",
    card: "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
    cardHover: "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
    elevated: "0 8px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
    modal: "0 16px 48px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.08)",
    glow: "0 2px 16px rgba(212,145,110,0.30)",
    glowStrong: "0 4px 24px rgba(212,145,110,0.40)",
  } : {
    sm: "0 1px 3px rgba(61,57,41,0.06)",
    card: "0 1px 2px rgba(61,57,41,0.04), 0 4px 12px rgba(61,57,41,0.06)",
    cardHover: "0 2px 4px rgba(61,57,41,0.06), 0 8px 24px rgba(61,57,41,0.08)",
    elevated: "0 4px 16px rgba(61,57,41,0.08), 0 12px 32px rgba(61,57,41,0.06)",
    modal: "0 8px 32px rgba(61,57,41,0.12), 0 24px 64px rgba(61,57,41,0.08)",
    glow: "0 2px 12px rgba(204,120,92,0.25)",
    glowStrong: "0 4px 20px rgba(204,120,92,0.35)",
  };

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

  return { colors, radius, blur, shadow, spacing, typography, motion, glass, zIndex };
}

// ──────────────────────────────────────────────────────────────────
// DEFAULT EXPORT (light — used as fallback / static import)
// ──────────────────────────────────────────────────────────────────
const tokens = buildTokens("light");

export { buildTokens, lightColors, darkColors, radius, blur, spacing, typography, motion, zIndex };
export default tokens;
