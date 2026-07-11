"use client";
import { createTheme, responsiveFontSizes, alpha } from "@mui/material/styles";
import type { Shadows } from "@mui/material/styles";
// Enables typed theme overrides for the X DataGrid (theme.components.MuiDataGrid).
import type {} from "@mui/x-data-grid/themeAugmentation";

/**
 * DESIGN SYSTEM — "refined operational instrument".
 *
 * A disciplined, Stripe/Linear/Vercel-grade surface for tenant admins: a true
 * neutral ink ramp, the brand teal kept as a sharp accent (not washed
 * everywhere), hairline borders, layered soft shadows, tabular numerals and
 * fast (150–200ms) motion. Every page inherits this — nothing here changes
 * business logic. The /superadmin console keeps its own nested theme.
 *
 * Type: a distinctive display face (Bricolage Grotesque, `--font-display`) for
 * headings + figures, paired with Hind Siliguri (`--font-bengali`) for body and
 * Bengali conjuncts. Latin renders in the display face; Bengali glyphs fall
 * through to Hind Siliguri automatically (per-glyph fallback).
 */

/* ── Tokens ───────────────────────────────────────────────────────────────── */

const ink = "17,34,29"; // brand-tinted near-black, as an rgb triple for alpha()

const T = {
  // Brand
  primary: "#0F7A6B",
  primaryDark: "#0A5A4E",
  primaryLight: "#3FA595",
  accent: "#E4890B",
  accentDark: "#B96F00",
  accentLight: "#F6B24A",
  // Semantic
  success: "#15925A",
  error: "#DC2626",
  warning: "#D97706",
  info: "#0284C7",
  // Neutrals (cool, faintly warm to sit with teal)
  ink900: "#0E1B17",
  ink700: "#243A33",
  ink500: "#516B63",
  ink400: "#6B837B",
  bg: "#F5F7F5",
  paper: "#FFFFFF",
  line: `rgba(${ink},0.09)`,
  lineStrong: `rgba(${ink},0.14)`,
} as const;

// Radius scale — tight and consistent.
const R = { xs: 8, sm: 10, md: 12, lg: 16, xl: 20 } as const;

const focusRing = `0 0 0 3px ${alpha(T.primary, 0.18)}`;

// Layered, low-opacity elevation scale (cool ink tint). Index 0 = "none".
const s = (v: string) => v;
const shadows: Shadows = [
  "none",
  s(`0 1px 2px rgba(${ink},0.05), 0 1px 3px rgba(${ink},0.05)`),
  s(`0 2px 4px -1px rgba(${ink},0.05), 0 4px 8px -2px rgba(${ink},0.08)`),
  s(`0 4px 8px -2px rgba(${ink},0.06), 0 8px 18px -6px rgba(${ink},0.10)`),
  s(`0 6px 12px -3px rgba(${ink},0.07), 0 12px 26px -8px rgba(${ink},0.12)`),
  s(`0 8px 16px -4px rgba(${ink},0.08), 0 16px 34px -10px rgba(${ink},0.14)`),
  s(`0 10px 20px -5px rgba(${ink},0.09), 0 22px 44px -12px rgba(${ink},0.16)`),
  s(`0 12px 24px -6px rgba(${ink},0.10), 0 26px 52px -14px rgba(${ink},0.18)`),
  s(`0 16px 30px -8px rgba(${ink},0.12), 0 32px 60px -16px rgba(${ink},0.20)`),
].concat(
  Array.from(
    { length: 16 },
    () => s(`0 20px 40px -10px rgba(${ink},0.14), 0 40px 72px -20px rgba(${ink},0.22)`)
  )
) as Shadows;

const bodyFont =
  "var(--font-bengali), 'Hind Siliguri', 'Noto Sans Bengali', system-ui, -apple-system, sans-serif";
const displayFont =
  "var(--font-display), var(--font-bengali), 'Hind Siliguri', system-ui, sans-serif";

/* ── Theme ────────────────────────────────────────────────────────────────── */

const baseTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: T.primary, dark: T.primaryDark, light: T.primaryLight, contrastText: "#ffffff" },
    secondary: { main: T.accent, dark: T.accentDark, light: T.accentLight, contrastText: "#ffffff" },
    success: { main: T.success, contrastText: "#ffffff" },
    error: { main: T.error, contrastText: "#ffffff" },
    warning: { main: T.warning, contrastText: "#ffffff" },
    info: { main: T.info, contrastText: "#ffffff" },
    text: { primary: T.ink900, secondary: T.ink500, disabled: T.ink400 },
    background: { default: T.bg, paper: T.paper },
    divider: T.line,
    grey: {
      50: "#F7F8F7",
      100: "#EEF1EF",
      200: "#E2E7E4",
      300: "#CDD6D1",
      400: "#A7B3AE",
      500: "#7C8A84",
      600: "#5B6B66",
      700: "#3E4E48",
      800: "#243A33",
      900: "#0E1B17",
    },
  },
  shape: { borderRadius: R.md },
  spacing: 8,
  shadows,
  typography: {
    fontFamily: bodyFont,
    fontSize: 15,
    button: { textTransform: "none", fontWeight: 650, letterSpacing: "0.01em" },
    h1: { fontFamily: displayFont, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08 },
    h2: { fontFamily: displayFont, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.12 },
    h3: { fontFamily: displayFont, fontWeight: 780, letterSpacing: "-0.02em", lineHeight: 1.16 },
    h4: { fontFamily: displayFont, fontWeight: 760, letterSpacing: "-0.02em", lineHeight: 1.2 },
    h5: { fontFamily: displayFont, fontWeight: 750, letterSpacing: "-0.015em", lineHeight: 1.25 },
    h6: { fontFamily: displayFont, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 },
    subtitle1: { fontWeight: 650, letterSpacing: "-0.005em" },
    subtitle2: { fontWeight: 650 },
    body1: { letterSpacing: "-0.003em" },
    body2: { letterSpacing: "-0.002em" },
    overline: { fontWeight: 700, letterSpacing: "0.12em", fontSize: "0.68rem" },
    caption: { letterSpacing: "0" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
        body: {
          // Faint, layered atmosphere instead of a flat fill.
          backgroundColor: T.bg,
          backgroundImage: `radial-gradient(1200px 600px at 100% -10%, ${alpha(
            T.primary,
            0.05
          )}, transparent 60%), radial-gradient(900px 500px at -10% 0%, ${alpha(
            T.accent,
            0.04
          )}, transparent 55%)`,
          backgroundAttachment: "fixed",
        },
        "::selection": { background: alpha(T.primary, 0.18) },
        // Slim, unobtrusive scrollbars (WebKit).
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: alpha(T.ink700, 0.22),
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "content-box",
        },
        "*::-webkit-scrollbar-thumb:hover": { backgroundColor: alpha(T.ink700, 0.34) },
      },
    },

    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: R.sm,
          minHeight: 44,
          paddingInline: 18,
          fontWeight: 650,
          transition:
            "background-color .16s ease, box-shadow .18s ease, border-color .16s ease, transform .12s ease",
          "&:active": { transform: "translateY(0.5px)" },
        },
        sizeSmall: { minHeight: 36, paddingInline: 12, borderRadius: R.xs },
        sizeLarge: { minHeight: 52, fontSize: "1.02rem", paddingInline: 24 },
        contained: {
          boxShadow: `0 1px 2px rgba(${ink},0.10), inset 0 1px 0 ${alpha("#ffffff", 0.12)}`,
          "&:hover": { boxShadow: `0 4px 14px -4px ${alpha(T.primary, 0.5)}` },
        },
        containedPrimary: {
          backgroundImage: `linear-gradient(180deg, ${T.primaryLight}22, transparent), linear-gradient(180deg, ${T.primary}, ${T.primaryDark})`,
        },
        outlined: {
          borderColor: T.lineStrong,
          backgroundColor: alpha("#ffffff", 0.6),
          "&:hover": { borderColor: alpha(T.primary, 0.5), backgroundColor: alpha(T.primary, 0.04) },
        },
        text: { "&:hover": { backgroundColor: alpha(T.primary, 0.06) } },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: R.sm, transition: "background-color .16s ease, color .16s ease" },
      },
    },

    MuiTextField: { defaultProps: { fullWidth: true, size: "medium" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: R.sm,
          backgroundColor: "#fff",
          transition: "box-shadow .16s ease, border-color .16s ease",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: T.lineStrong },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha(T.ink700, 0.28) },
          "&.Mui-focused": { boxShadow: focusRing },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: T.primary, borderWidth: 1 },
        },
        input: { fontVariantNumeric: "tabular-nums" },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 600 } } },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: R.lg,
          border: `1px solid ${T.line}`,
          backgroundImage: "none",
          boxShadow: `0 1px 2px rgba(${ink},0.04), 0 10px 28px -14px rgba(${ink},0.16)`,
        },
      },
    },
    MuiCardContent: { styleOverrides: { root: { "&:last-child": { paddingBottom: 20 } } } },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: R.lg },
        outlined: { borderColor: T.line },
      },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: `linear-gradient(180deg, ${T.primary}, ${T.primaryDark})`,
          borderBottom: `1px solid ${alpha("#000", 0.08)}`,
          boxShadow: `0 1px 0 rgba(${ink},0.04), 0 10px 30px -18px rgba(${ink},0.6)`,
          backdropFilter: "saturate(1.1)",
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: T.paper, borderColor: T.line, backgroundImage: "none" },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: R.sm,
          transition: "background-color .16s ease, color .16s ease",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 650, borderRadius: 8, letterSpacing: "-0.005em" },
        sizeSmall: { height: 22, fontSize: "0.72rem" },
        outlined: { borderColor: T.lineStrong },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: R.xl,
          border: `1px solid ${T.line}`,
          boxShadow: `0 24px 60px -20px rgba(${ink},0.34), 0 8px 24px -12px rgba(${ink},0.2)`,
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(T.ink900, 0.42),
          backdropFilter: "blur(3px)",
        },
        invisible: { backgroundColor: "transparent", backdropFilter: "none" },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: displayFont, fontWeight: 750 } } },

    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: R.md,
          border: `1px solid ${T.line}`,
          boxShadow: `0 12px 32px -12px rgba(${ink},0.24)`,
          marginTop: 4,
        },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: R.xs, margin: "2px 6px" } } },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: T.ink900,
          borderRadius: R.xs,
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "6px 10px",
          boxShadow: `0 8px 20px -8px rgba(${ink},0.4)`,
        },
        arrow: { color: T.ink900 },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 650,
          minHeight: 44,
          letterSpacing: "-0.005em",
          transition: "color .16s ease",
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: alpha(T.ink700, 0.1) },
        bar: { borderRadius: 999 },
      },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: T.line } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: R.md, fontWeight: 550, border: `1px solid ${T.line}` },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: T.line },
        head: { fontWeight: 700, color: T.ink700, backgroundColor: alpha(T.ink700, 0.03) },
      },
    },

    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 0,
          fontVariantNumeric: "tabular-nums",
          "--DataGrid-rowBorderColor": T.line,
          "--DataGrid-containerBackground": alpha(T.ink700, 0.03),
        },
        columnHeaders: { borderRadius: 0 },
        columnHeaderTitle: { fontWeight: 700, color: T.ink700, letterSpacing: "-0.005em" },
        cell: {
          borderColor: T.line,
          "&:focus, &:focus-within": { outline: "none" },
        },
        columnHeader: { "&:focus, &:focus-within": { outline: "none" } },
        row: {
          transition: "background-color .12s ease",
          "&:hover": { backgroundColor: alpha(T.primary, 0.04) },
          "&.Mui-selected": {
            backgroundColor: alpha(T.primary, 0.08),
            "&:hover": { backgroundColor: alpha(T.primary, 0.12) },
          },
        },
        footerContainer: { borderColor: T.line },
        overlay: { backgroundColor: alpha("#fff", 0.6) },
      },
    },
  },
});

// Scale heading/body sizes down on small screens (mobile-first legibility).
const theme = responsiveFontSizes(baseTheme, { factor: 2.1 });

export default theme;
