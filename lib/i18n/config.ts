export type Locale = "bn" | "en";
export const LOCALES: Locale[] = ["bn", "en"];
export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "locale";

export function normalizeLocale(v: string | undefined | null): Locale {
  return v === "en" ? "en" : "bn";
}
