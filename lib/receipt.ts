import { monthName, taka, toBnDigits } from "@/lib/format";

export type ReceiptData = {
  centerName: string;
  studentName: string;
  roll: string;
  className: string;
  sectionName: string;
  month: number;
  year: number;
  lines: { label: string; amount: number }[];
  total: number;
  paid: number;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/** Build clean printable receipt HTML. */
export function buildReceiptHtml(d: ReceiptData): string {
  const due = Math.max(0, d.total - d.paid);
  const rows = d.lines
    .filter((l) => l.amount > 0)
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.label)}</td><td style="text-align:right">${taka(l.amount)}</td></tr>`
    )
    .join("");

  return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<title>রসিদ</title>
<style>
  body{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;padding:24px;color:#111;max-width:520px;margin:auto}
  h1{font-size:20px;text-align:center;margin:0 0 4px}
  .sub{text-align:center;color:#555;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  td,th{padding:8px 6px;border-bottom:1px solid #eee}
  .meta{display:flex;justify-content:space-between;font-size:14px;margin:4px 0}
  .total td{font-weight:700;border-top:2px solid #333;border-bottom:none}
  .due{color:#b00}
  @media print{button{display:none}}
</style></head><body>
  <h1>${escapeHtml(d.centerName)}</h1>
  <div class="sub">পেমেন্ট রসিদ — ${monthName(d.month)} ${toBnDigits(d.year)}</div>
  <div class="meta"><span>নাম: <b>${escapeHtml(d.studentName)}</b></span><span>রোল: ${toBnDigits(
    d.roll
  )}</span></div>
  <div class="meta"><span>ক্লাস: ${escapeHtml(d.className)}</span><span>শাখা: ${escapeHtml(
    d.sectionName
  )}</span></div>
  <table>
    <thead><tr><th style="text-align:left">বিবরণ</th><th style="text-align:right">পরিমাণ</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total"><td>মোট</td><td style="text-align:right">${taka(d.total)}</td></tr>
      <tr><td>পরিশোধিত</td><td style="text-align:right">${taka(d.paid)}</td></tr>
      <tr><td class="due">বাকি</td><td style="text-align:right" class="due">${taka(due)}</td></tr>
    </tbody>
  </table>
  <p style="text-align:center;margin-top:24px;color:#888;font-size:12px">ধন্যবাদ</p>
  <div style="text-align:center"><button onclick="window.print()">প্রিন্ট</button></div>
</body></html>`;
}

/** Open the receipt in a new window and trigger print. */
export function printReceipt(d: ReceiptData) {
  const html = buildReceiptHtml(d);
  const w = window.open("", "_blank", "width=600,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/** Plain-text receipt summary for WhatsApp/SMS. */
export function receiptText(d: ReceiptData): string {
  const due = Math.max(0, d.total - d.paid);
  const lines = d.lines
    .filter((l) => l.amount > 0)
    .map((l) => `• ${l.label}: ${taka(l.amount)}`)
    .join("\n");
  return (
    `${d.centerName}\n` +
    `পেমেন্ট রসিদ — ${monthName(d.month)} ${toBnDigits(d.year)}\n` +
    `নাম: ${d.studentName} (রোল ${toBnDigits(d.roll)})\n` +
    `ক্লাস: ${d.className}${d.sectionName ? " " + d.sectionName : ""}\n` +
    `${lines}\n` +
    `মোট: ${taka(d.total)}\nপরিশোধিত: ${taka(d.paid)}\nবাকি: ${taka(due)}`
  );
}

/** Open WhatsApp with a prefilled receipt message to the given phone. */
export function shareReceiptWhatsApp(d: ReceiptData, phone: string) {
  // Normalise BD numbers to international format for wa.me.
  let p = (phone || "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "88" + p;
  else if (!p.startsWith("88") && p.length === 10) p = "880" + p;
  const text = encodeURIComponent(receiptText(d));
  const url = p ? `https://wa.me/${p}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener");
}
