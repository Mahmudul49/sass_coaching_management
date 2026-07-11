import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireConsoleUser } from "@/lib/auth/guards";
import { getConsoleTheme } from "@/lib/superadmin/theme";
import { I18nProvider } from "@/components/providers/I18nProvider";
import ConsoleThemeProvider from "@/components/providers/ConsoleThemeProvider";
import ConsoleShell from "@/components/superadmin/ConsoleShell";
import type { ThemeMode } from "@/lib/theme/console";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { role } = await requireConsoleUser(); // redirects to /login or 403s
  const [theme, cookieStore] = await Promise.all([getConsoleTheme(), cookies()]);
  const mode: ThemeMode =
    cookieStore.get("console-theme-mode")?.value === "dark" ? "dark" : "light";

  // Super Admin console always renders in English.
  return (
    <I18nProvider initialLocale="en">
      <ConsoleThemeProvider light={theme.light} dark={theme.dark} initialMode={mode}>
        <ConsoleShell role={role}>{children}</ConsoleShell>
      </ConsoleThemeProvider>
    </I18nProvider>
  );
}
