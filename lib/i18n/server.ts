import "server-only";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { dict, type MessageKey } from "./dictionaries";

/** English-only. Kept async so existing `await getLocale()` call sites are unchanged. */
export async function getLocale(): Promise<Locale> {
  return DEFAULT_LOCALE;
}

/** Server-side translator — always resolves the English catalogue. */
export async function getT(): Promise<(k: MessageKey) => string> {
  return (k: MessageKey) => dict.en[k] ?? k;
}
