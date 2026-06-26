import { monthName, taka, toBnDigits } from "@/lib/format";

/**
 * Ready-to-use Bengali SMS templates. Keep them short — BD SMS is billed per
 * 70 Bengali chars (Unicode).
 */
export const smsTemplates = {
  attendancePresent(args: { centerName: string; studentName: string; date: string }) {
    return `${args.centerName}: ${args.studentName} আজ (${toBnDigits(args.date)}) উপস্থিত ছিল। ধন্যবাদ।`;
  },
  attendanceAbsent(args: { centerName: string; studentName: string; date: string }) {
    return `${args.centerName}: ${args.studentName} আজ (${toBnDigits(args.date)}) অনুপস্থিত ছিল।`;
  },
  paymentReceived(args: {
    centerName: string;
    studentName: string;
    month: number;
    year: number;
    paid: number;
    due: number;
  }) {
    const duePart = args.due > 0 ? ` বাকি ${taka(args.due)}।` : " সম্পূর্ণ পরিশোধিত।";
    return `${args.centerName}: ${args.studentName} এর ${monthName(args.month)} ${toBnDigits(
      args.year
    )} মাসের ফি ${taka(args.paid)} জমা হয়েছে।${duePart}`;
  },
  paymentDue(args: {
    centerName: string;
    studentName: string;
    month: number;
    year: number;
    due: number;
  }) {
    return `${args.centerName}: ${args.studentName} এর ${monthName(args.month)} ${toBnDigits(
      args.year
    )} মাসের ${taka(args.due)} ফি বাকি আছে। অনুগ্রহ করে পরিশোধ করুন।`;
  },
};
