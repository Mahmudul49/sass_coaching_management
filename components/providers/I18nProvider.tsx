"use client";
import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dict, type MessageKey } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

type I18nApi = {
  locale: Locale;
  t: (k: MessageKey) => string;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

const I18nContext = createContext<I18nApi | null>(null);

/**
 * Client i18n. `initialLocale` comes from the cookie (read on the server) so
 * SSR and client agree. Switching writes the cookie + `router.refresh()` so
 * server components re-render in the new language too — near-instant, no full
 * page reload.
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      setLocaleState(l);
      document.documentElement.lang = l;
      router.refresh();
    },
    [router]
  );

  const api = useMemo<I18nApi>(
    () => ({
      locale,
      t: (k) => dict[locale][k] ?? dict.bn[k] ?? k,
      setLocale,
      toggle: () => setLocale(locale === "bn" ? "en" : "bn"),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={api}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
