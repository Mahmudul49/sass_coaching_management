import { createTheme, responsiveFontSizes, type Theme } from "@mui/material/styles";
import type { ThemePalette } from "@/lib/db/collections";

/**
 * Central-console theme system (SuperAdmin Theme Builder).
 *
 * A `ThemePalette` is a flat set of design tokens (hex strings) editable in the
 * Theme Builder and stored in the `themeSettings` collection. `buildConsoleTheme`
 * maps those tokens onto a full MUI theme so every existing MUI component in the
 * console restyles automatically — no per-component edits. The non-MUI tokens
 * (sidebar, navbar, button) are additionally surfaced as CSS variables by
 * `paletteCssVars` and consumed by the console shell.
 *
 * This is scoped to `/superadmin/*` only; tenant UIs keep `lib/theme.ts`.
 */

export type ThemeMode = "light" | "dark";

/** Token metadata that drives the Theme Builder picker grid. */
export const THEME_TOKENS: { key: keyof ThemePalette; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Main brand color, primary buttons & active nav" },
  { key: "secondary", label: "Secondary", hint: "Secondary actions & accents" },
  { key: "accent", label: "Accent", hint: "Highlights, info chips & links" },
  { key: "success", label: "Success", hint: "Positive states" },
  { key: "warning", label: "Warning", hint: "Caution states" },
  { key: "error", label: "Error", hint: "Errors & destructive actions" },
  { key: "background", label: "Background", hint: "App background behind cards" },
  { key: "surface", label: "Surface", hint: "Cards, tables, dialogs" },
  { key: "text", label: "Text", hint: "Primary text color" },
  { key: "border", label: "Border", hint: "Dividers & card borders" },
  { key: "sidebar", label: "Sidebar", hint: "Left navigation background" },
  { key: "navbar", label: "Navbar", hint: "Top bar background" },
  { key: "button", label: "Button", hint: "Default button background" },
];

export const DEFAULT_CONSOLE_THEME: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    primary: "#0F7A6B",
    secondary: "#E4890B",
    accent: "#0284C7",
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    background: "#F4F6F3",
    surface: "#FFFFFF",
    text: "#12241F",
    border: "#E2E7E4",
    sidebar: "#0B3F38",
    navbar: "#0F7A6B",
    button: "#0F7A6B",
  },
  dark: {
    primary: "#3FA595",
    secondary: "#F6B24A",
    accent: "#38BDF8",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    background: "#0B1412",
    surface: "#13201C",
    text: "#E7EFEC",
    border: "#25322E",
    sidebar: "#0A1917",
    navbar: "#13201C",
    button: "#3FA595",
  },
};

/** Emit the design tokens as CSS custom properties for shell/consumer use. */
export function paletteCssVars(p: ThemePalette): Record<string, string> {
  return {
    "--color-primary": p.primary,
    "--color-secondary": p.secondary,
    "--color-accent": p.accent,
    "--color-success": p.success,
    "--color-warning": p.warning,
    "--color-error": p.error,
    "--color-background": p.background,
    "--color-surface": p.surface,
    "--color-text": p.text,
    "--color-border": p.border,
    "--sidebar-bg": p.sidebar,
    "--sidebar-fg": contrastOn(p.sidebar),
    "--navbar-bg": p.navbar,
    "--navbar-fg": contrastOn(p.navbar),
    "--btn-bg": p.button,
    "--btn-fg": contrastOn(p.button),
  };
}

function contrastOn(hex: string): string {
  // Relative-luminance pick between black/white text on a given background.
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? "rgba(0,0,0,0.87)" : "#ffffff";
}

/** Build a full MUI theme for the console from a flat token palette. */
export function buildConsoleTheme(p: ThemePalette, mode: ThemeMode): Theme {
  const base = createTheme({
    palette: {
      mode,
      primary: { main: p.primary, contrastText: contrastOn(p.primary) },
      secondary: { main: p.secondary, contrastText: contrastOn(p.secondary) },
      info: { main: p.accent },
      success: { main: p.success },
      warning: { main: p.warning },
      error: { main: p.error },
      text: {
        primary: p.text,
        secondary: mode === "dark" ? "rgba(231,239,236,0.66)" : "rgba(18,36,31,0.62)",
      },
      background: { default: p.background, paper: p.surface },
      divider: p.border,
    },
    shape: { borderRadius: 14 },
    spacing: 8,
    typography: {
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif",
      fontSize: 15,
      button: { textTransform: "none", fontWeight: 600 },
      h4: { fontWeight: 800, letterSpacing: "-0.5px" },
      h5: { fontWeight: 800, letterSpacing: "-0.3px" },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { variant: "contained", disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, minHeight: 46, paddingInline: 20, fontWeight: 600 },
          sizeLarge: { minHeight: 54, fontSize: "1.05rem" },
        },
      },
      MuiTextField: { defaultProps: { fullWidth: true, size: "medium" } },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            border: `1px solid ${p.border}`,
            backgroundImage: "none",
            boxShadow:
              mode === "dark"
                ? "0 1px 2px rgba(0,0,0,0.4), 0 10px 30px -18px rgba(0,0,0,0.8)"
                : "0 1px 2px rgba(18,36,31,0.04), 0 8px 24px -12px rgba(18,36,31,0.14)",
          },
        },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 18 }, root: { backgroundImage: "none" } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
  return responsiveFontSizes(base, { factor: 2.2 });
}
