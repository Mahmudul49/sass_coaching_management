// The application is English-only. The `Locale` union is retained so the shared
// formatting helpers (lib/format.ts) keep their branch signatures, but every
// resolver normalises to "en" and there is no language switcher.
export type Locale = "bn" | "en";
export const LOCALES: Locale[] = ["en"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";
