import { monthName, taka } from "@/lib/format";
import {
  brandHeader,
  docFooter,
  escapeHtml,
  metaGrid,
  openPrintWindow,
  qrBadge,
  renderPrintDoc,
  signature,
} from "@/lib/print/document";

export type ReceiptData = {
  centerName: string;
  logoUrl?: string;
  receiptNo?: string; // auto-derived from period + roll when omitted
  studentName: string;
  roll: string;
  className: string;
  sectionName: string;
  phone?: string;
  month: number;
  year: number;
  lines: { label: string; amount: number }[];
  total: number;
  paid: number;
  remarks?: string;
  verifyUrl?: string; // QR encodes this if given; otherwise a self-contained summary
  showQr?: boolean; // default true
};

/** Stable, human-readable receipt number derived from the period + roll. */
function receiptNumber(d: ReceiptData): string {
  if (d.receiptNo) return d.receiptNo;
  const roll = String(d.roll || "0").replace(/\D/g, "").padStart(4, "0");
  return `RC-${d.year}${String(d.month).padStart(2, "0")}-${roll}`;
}

/** Compact plain-text summary — used for the QR payload and WhatsApp share. */
export function receiptText(d: ReceiptData): string {
  const due = Math.max(0, d.total - d.paid);
  const advance = Math.max(0, d.paid - d.total);
  const lines = d.lines
    .filter((l) => l.amount > 0)
    .map((l) => `• ${l.label}: ${taka(l.amount)}`)
    .join("\n");
  return (
    `${d.centerName}\n` +
    `Payment Receipt ${receiptNumber(d)} — ${monthName(d.month)} ${d.year}\n` +
    `Name: ${d.studentName} (Roll ${d.roll})\n` +
    `Class: ${d.className}${d.sectionName ? " " + d.sectionName : ""}\n` +
    `${lines}\n` +
    `Total: ${taka(d.total)}\nPaid: ${taka(d.paid)}\n` +
    (advance > 0 ? `Advance: ${taka(advance)}` : `Due: ${taka(due)}`)
  );
}

/** Build the branded, printable receipt HTML (A4 portrait, engraved frame). */
export function buildReceiptHtml(d: ReceiptData): string {
  const due = Math.max(0, d.total - d.paid);
  const advance = Math.max(0, d.paid - d.total);
  const receiptNo = receiptNumber(d);

  const lineRows = d.lines
    .filter((l) => l.amount > 0)
    .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td class="r">${taka(l.amount)}</td></tr>`)
    .join("");

  const balanceRow =
    advance > 0
      ? `<tr><td>Advance</td><td class="r">${taka(advance)}</td></tr>`
      : `<tr><td class="due">Due</td><td class="r due">${taka(due)}</td></tr>`;

  const moneyTable = `<table class="data receipt-lines">
    <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
    <tbody>
      ${lineRows || `<tr><td colspan="2" style="text-align:center;color:var(--muted)">No fee lines</td></tr>`}
      <tr class="total"><td>Total</td><td class="r">${taka(d.total)}</td></tr>
      <tr><td>Paid</td><td class="r">${taka(d.paid)}</td></tr>
      ${balanceRow}
    </tbody>
  </table>`;

  const meta = metaGrid([
    { label: "Student", value: d.studentName, grow: true },
    { label: "Class", value: `${d.className}${d.sectionName ? " · " + d.sectionName : ""}` },
    { label: "Roll", value: d.roll },
    ...(d.phone ? [{ label: "Phone", value: d.phone }] : []),
    { label: "Date", value: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ]);

  const showQr = d.showQr !== false;
  const qr = showQr
    ? qrBadge(d.verifyUrl || receiptText(d), { title: "Verify", note: "Scan to verify this receipt's details." })
    : "";

  const remarks = d.remarks
    ? `<p class="remarks"><b>Remarks:</b> ${escapeHtml(d.remarks)}</p>`
    : "";

  const body = `
    ${brandHeader({
      centerName: d.centerName,
      eyebrow: "Payment Receipt",
      subtitle: `${monthName(d.month)} ${d.year}`,
      logoUrl: d.logoUrl,
      badge: { label: "Receipt No", value: receiptNo },
    })}
    ${meta}
    ${moneyTable}
    ${remarks}
    <div class="sigrow">
      ${qr || "<span></span>"}
      ${signature("Authorised Signature")}
    </div>
    ${docFooter("Computer-generated payment receipt")}
  `;

  const extraCss = `
    .receipt-lines{max-width:520px}
    .remarks{margin-top:12px;font-size:12px;color:#3d4d47}
  `;

  return renderPrintDoc({ title: `Receipt ${receiptNo}`, body, orientation: "portrait", framed: true, extraCss });
}

/** Open the receipt in a new window and trigger print. */
export function printReceipt(d: ReceiptData) {
  openPrintWindow(buildReceiptHtml(d), 640, 900);
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
