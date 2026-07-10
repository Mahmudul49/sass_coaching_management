// Formatting helpers shared across the app. Bengali-facing by default; pass
// locale "en" to render Western digits / English month names (e.g. the admin
// dashboard renders fully in English). The default stays "bn" so every existing
// caller is unchanged.
import type { Locale } from "@/lib/i18n/config";

export const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1-12 -> month name in the given locale (Bengali by default). */
export function monthName(month: number, locale: Locale = "bn"): string {
  const months = locale === "en" ? EN_MONTHS : BN_MONTHS;
  return months[month - 1] ?? String(month);
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/**
 * Localise digits in a string/number. Bengali by default; locale "en" keeps the
 * ASCII digits as-is (so the same call sites work in an English view).
 */
export function toBnDigits(value: string | number, locale: Locale = "bn"): string {
  if (locale === "en") return String(value);
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Money with a ৳ sign, e.g. ৳১,২০০ (bn) or ৳1,200 (en). */
export function taka(amount: number, locale: Locale = "bn"): string {
  const rounded = Math.round(amount || 0);
  const grouped = rounded.toLocaleString("en-US");
  return `৳${toBnDigits(grouped, locale)}`;
}

/** Today's date as YYYY-MM-DD (local time). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

/** A small list of years for dropdowns: [current-1 .. current+1]. */
export function yearOptions(): number[] {
  const y = currentYear();
  return [y - 1, y, y + 1];
}
