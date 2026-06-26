"use client";
import { createTheme } from "@mui/material/styles";

/**
 * App theme. Large tap targets, rounded cards and a calm green/teal palette —
 * tuned for non-technical admins on phones.
 */
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0f766e" }, // teal-700
    secondary: { main: "#b45309" }, // amber-700
    success: { main: "#15803d" },
    error: { main: "#dc2626" },
    background: { default: "#f5f7f6", paper: "#ffffff" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif",
    button: { textTransform: "none", fontWeight: 600 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 44, paddingInline: 18 },
        sizeLarge: { minHeight: 52, fontSize: "1.05rem" },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true, size: "medium" } },
    MuiCard: { styleOverrides: { root: { borderRadius: 16 } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
  },
});

export default theme;
