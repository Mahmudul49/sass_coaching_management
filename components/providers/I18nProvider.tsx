"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { dict, type MessageKey } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type I18nApi = {
  locale: Locale;
  t: (k: MessageKey) => string;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

const noop = () => {};
const I18nContext = createContext<I18nApi | null>(null);

/**
 * English is the only supported language. This provider preserves the `useI18n`
 * contract (`{ locale, t, setLocale, toggle }`) so the ~50 existing call sites
 * compile unchanged, while always resolving the English catalogue. `setLocale`
 * and `toggle` are no-ops — the language switcher has been removed.
 * `initialLocale` is accepted and ignored for backward compatibility.
 */
export function I18nProvider({
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const api = useMemo<I18nApi>(
    () => ({
      locale: "en",
      t: (k) => dict.en[k] ?? k,
      setLocale: noop,
      toggle: noop,
    }),
    []
  );
  return <I18nContext.Provider value={api}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
