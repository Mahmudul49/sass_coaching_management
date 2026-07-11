"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import GlobalStyles from "@mui/material/GlobalStyles";
import type { ThemePalette } from "@/lib/db/collections";
import {
  buildConsoleTheme,
  paletteCssVars,
  type ThemeMode,
} from "@/lib/theme/console";

/**
 * Dynamic theme for the central console ONLY. Nested inside `/superadmin/layout`
 * so it overrides the global tenant theme for this subtree while leaving every
 * `/[tenant]` page on `lib/theme.ts`.
 *
 * Holds the light/dark `mode` in client state (instant toggle, no rebuild) and
 * mirrors it to a cookie so SSR picks the same mode on the next load. Design
 * tokens are also exposed as CSS variables for the shell (sidebar/navbar/button).
 */

const COOKIE = "console-theme-mode";

type ModeApi = { mode: ThemeMode; toggle: () => void };
const ModeContext = createContext<ModeApi | null>(null);

export function useConsoleMode(): ModeApi {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useConsoleMode must be used within ConsoleThemeProvider");
  return ctx;
}

export default function ConsoleThemeProvider({
  light,
  dark,
  initialMode,
  children,
}: {
  light: ThemePalette;
  dark: ThemePalette;
  initialMode: ThemeMode;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const palette = mode === "dark" ? dark : light;
  const theme = useMemo(() => buildConsoleTheme(palette, mode), [palette, mode]);
  const vars = useMemo(() => paletteCssVars(palette), [palette]);

  const api = useMemo<ModeApi>(
    () => ({
      mode,
      toggle: () =>
        setMode((m) => {
          const next = m === "dark" ? "light" : "dark";
          // Persist for the next SSR render (1 year).
          document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
          return next;
        }),
    }),
    [mode]
  );

  return (
    <ModeContext.Provider value={api}>
      <ThemeProvider theme={theme}>
        <GlobalStyles styles={{ ":root": vars as Record<string, string> }} />
        {children}
      </ThemeProvider>
    </ModeContext.Provider>
  );
}
