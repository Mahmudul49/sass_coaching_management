"use client";
import { createTheme } from "@mui/material/styles";

/**
 * "Warm scholarly" theme — a deep teal-emerald (trust, learning) paired with a
 * marigold accent (warmth, energy; culturally resonant in Bangladesh) over warm
 * neutrals. Restrained and professional, tuned for non-technical admins tapping
 * on Android phones: large touch targets, soft rounded cards, subtle shadows,
 * and Hind Siliguri (loaded in app/layout) for clean Bengali conjuncts.
 */
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0F7A6B", dark: "#0A5A4E", light: "#3FA595", contrastText: "#ffffff" },
    secondary: { main: "#E4890B", dark: "#B96F00", light: "#F6B24A", contrastText: "#ffffff" },
    success: { main: "#16A34A" },
    error: { main: "#DC2626" },
    warning: { main: "#D97706" },
    info: { main: "#0284C7" },
    text: { primary: "#12241F", secondary: "#5B6B66" },
    background: { default: "#F4F6F3", paper: "#FFFFFF" },
    divider: "rgba(18,36,31,0.10)",
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
          border: "1px solid rgba(18,36,31,0.07)",
          boxShadow: "0 1px 2px rgba(18,36,31,0.04), 0 8px 24px -12px rgba(18,36,31,0.14)",
        },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 18 } } },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: "0 1px 0 rgba(18,36,31,0.06), 0 6px 20px -14px rgba(18,36,31,0.5)" },
      },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

export default theme;
