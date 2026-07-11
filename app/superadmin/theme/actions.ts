"use server";
import { saveConsoleTheme, type ConsoleTheme } from "@/lib/superadmin/theme";

export type ActionResult = { ok: boolean; error?: string };

/** Persist the console theme (SuperAdmin only — enforced in saveConsoleTheme). */
export async function saveThemeAction(theme: ConsoleTheme): Promise<ActionResult> {
  return saveConsoleTheme(theme);
}
