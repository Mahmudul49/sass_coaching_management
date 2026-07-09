import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "./config";
import { dict, type MessageKey } from "./dictionaries";

/** Current locale from the cookie (server components / actions). */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return normalizeLocale(c);
}

/** Server-side translator bound to the request's locale. */
export async function getT(): Promise<(k: MessageKey) => string> {
  const locale = await getLocale();
  return (k: MessageKey) => dict[locale][k] ?? dict.bn[k] ?? k;
}
