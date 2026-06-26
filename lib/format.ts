// Formatting helpers shared across the app (Bengali-facing output).

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

/** 1-12 -> Bengali month name. */
export function monthName(month: number): string {
  return BN_MONTHS[month - 1] ?? String(month);
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Convert ASCII digits in a string/number to Bengali digits. */
export function toBnDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Money formatted with Bengali digits and a ৳ sign, e.g. ৳১,২০০. */
export function taka(amount: number): string {
  const rounded = Math.round(amount || 0);
  const grouped = rounded.toLocaleString("en-US");
  return `৳${toBnDigits(grouped)}`;
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
