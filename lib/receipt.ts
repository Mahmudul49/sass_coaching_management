import { monthName, taka } from "@/lib/format";
import {
  brandHeader,
  docFooter,
  escapeHtml,
  metaGrid,
  openPrintWindow,
  renderPrintDoc,
  signature,
} from "@/lib/print/document";
import { qrSvg } from "@/lib/print/qr";

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

/** Compact plain-text summary — used for the WhatsApp share message. */
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

/**
 * Compact single-line QR payload. Deliberately short and ASCII-numeric (no ৳
 * symbol) so the encoded QR stays a low version with large, reliably scannable
 * modules when printed. Falls back to a verify URL when one is supplied.
 */
function receiptQrPayload(d: ReceiptData): string {
  if (d.verifyUrl) return d.verifyUrl;
  const due = Math.max(0, d.total - d.paid);
  const advance = Math.max(0, d.paid - d.total);
  const balance = advance > 0 ? `Advance ${advance}` : due > 0 ? `Due ${due}` : "Cleared";
  return (
    `${d.centerName} | Receipt ${receiptNumber(d)} | ${d.studentName} Roll ${d.roll} | ` +
    `${monthName(d.month)} ${d.year} | Total ${d.total} Paid ${d.paid} | ${balance}`
  );
}

/** Build the branded, printable receipt HTML (A4 portrait, two-column ledger). */
export function buildReceiptHtml(d: ReceiptData): string {
  const due = Math.max(0, d.total - d.paid);
  const advance = Math.max(0, d.paid - d.total);
  const receiptNo = receiptNumber(d);

  // Left column: the itemized fee lines. Totals move to the summary card so the
  // page reads like a real invoice/ledger instead of one narrow, half-empty table.
  const lineRows = d.lines
    .filter((l) => l.amount > 0)
    .map(
      (l, i) =>
        `<tr><td><span class="rc-sl">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(
          l.label
        )}</td><td class="r">${taka(l.amount)}</td></tr>`
    )
    .join("");

  const itemsTable = `<table class="data rc-items">
    <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
    <tbody>${lineRows || `<tr><td colspan="2" class="rc-empty">No fee lines</td></tr>`}</tbody>
  </table>`;

  // Right column: payment summary + a status seal.
  const settled = d.total <= 0 || d.paid >= d.total;
  const statusKey = settled ? "paid" : d.paid > 0 ? "partial" : "due";
  const statusLabel = settled
    ? advance > 0
      ? "Advance Paid"
      : "Paid in Full"
    : d.paid > 0
    ? "Partially Paid"
    : "Payment Due";

  const balanceRow =
    advance > 0
      ? `<div class="rc-row rc-balance adv"><span>Advance</span><b>${taka(advance)}</b></div>`
      : `<div class="rc-row rc-balance ${due > 0 ? "due" : ""}"><span>Due</span><b>${taka(due)}</b></div>`;

  const summary = `<div class="rc-summary">
    <div class="rc-sum-head">Payment Summary</div>
    <div class="rc-row"><span>Total Payable</span><b>${taka(d.total)}</b></div>
    <div class="rc-row rc-total"><span>Amount Paid</span><b>${taka(d.paid)}</b></div>
    ${balanceRow}
    <div class="rc-status ${statusKey}">${escapeHtml(statusLabel)}</div>
  </div>`;

  // Professional QR: crisp black modules on a solid white field with a real
  // quiet zone, sized generously so print/phone scans read first time.
  const showQr = d.showQr !== false;
  const verify = showQr
    ? `<div class="rc-verify">
        <div class="rc-qr">${qrSvg(receiptQrPayload(d), {
          size: 138,
          margin: 4,
          dark: "#101820",
          light: "#ffffff",
        })}</div>
        <div class="rc-vk">Scan to Verify</div>
        <div class="rc-vn">${
          d.verifyUrl ? "Confirm this receipt online." : "Encodes this receipt&#39;s details."
        }</div>
      </div>`
    : "";

  const remarks = d.remarks
    ? `<div class="rc-remarks"><b>Remarks</b>${escapeHtml(d.remarks)}</div>`
    : "";

  const meta = metaGrid([
    { label: "Student", value: d.studentName, grow: true },
    { label: "Class", value: `${d.className}${d.sectionName ? " · " + d.sectionName : ""}` },
    { label: "Roll", value: d.roll },
    ...(d.phone ? [{ label: "Phone", value: d.phone }] : []),
    { label: "Date", value: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ]);

  const body = `
    ${brandHeader({
      centerName: d.centerName,
      eyebrow: "Payment Receipt",
      subtitle: `${monthName(d.month)} ${d.year}`,
      logoUrl: d.logoUrl,
      badge: { label: "Receipt No", value: receiptNo },
    })}
    ${meta}
    <div class="rc-body">
      <div class="rc-main">
        ${itemsTable}
        ${remarks}
        <div class="rc-sign">${signature("Authorised Signature")}</div>
      </div>
      <aside class="rc-aside">
        ${summary}
        ${verify}
      </aside>
    </div>
    ${docFooter("Computer-generated payment receipt")}
  `;

  const extraCss = `
    /* ── Payment receipt — two-column ledger layout ─────────────────────── */
    .rc-body{display:flex;gap:16px;margin-top:14px;align-items:stretch}
    .rc-main{flex:1;min-width:0;display:flex;flex-direction:column}
    .rc-aside{width:220px;flex:none;display:flex;flex-direction:column;gap:12px}

    /* Itemized fee table (reuses .data, tuned for the receipt) */
    .rc-items{margin-top:0}
    .rc-items thead th{font-size:9px}
    .rc-items .rc-sl{display:inline-block;min-width:20px;margin-right:8px;font-size:10px;font-weight:700;
      color:var(--muted);font-variant-numeric:tabular-nums}
    .rc-items td.r{font-weight:700;color:var(--teal-d)}
    .rc-empty{text-align:center;color:var(--muted);padding:18px}

    .rc-remarks{margin-top:12px;font-size:11px;color:#3d4d47;line-height:1.5;
      background:rgba(15,122,107,.045);border-left:3px solid var(--gold);padding:8px 12px;border-radius:0 8px 8px 0}
    .rc-remarks b{display:block;font-size:8px;letter-spacing:.14em;text-transform:uppercase;
      color:var(--teal-d);font-weight:800;margin-bottom:2px}

    /* Signature sits at the foot of the left column, level with the aside */
    .rc-sign{margin-top:auto;padding-top:30px;display:flex;justify-content:flex-end}

    /* Summary ledger card */
    .rc-summary{border:1px solid var(--gold-l);border-radius:10px;overflow:hidden;background:#fff;
      box-shadow:0 3px 10px rgba(11,26,22,.06)}
    .rc-sum-head{background:var(--teal);color:#fff;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;
      font-weight:700;text-align:center;padding:7px 12px;border-bottom:2px solid var(--gold)}
    .rc-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:8px 12px}
    .rc-row+.rc-row{border-top:1px solid var(--line)}
    .rc-row span{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-size:8.5px;font-weight:700}
    .rc-row b{font-family:var(--display);font-weight:800;font-size:15px;line-height:1;color:var(--ink);
      font-variant-numeric:tabular-nums}
    .rc-row.rc-total{background:var(--gold-soft)}
    .rc-row.rc-total b{color:var(--teal-d)}
    .rc-row.rc-balance{background:rgba(15,122,107,.05)}
    .rc-row.rc-balance.due b{color:var(--danger)}
    .rc-row.rc-balance.adv b{color:var(--teal-d)}
    .rc-status{text-align:center;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
      font-size:10px;padding:9px 8px;color:#fff}
    .rc-status.paid{background:linear-gradient(135deg,var(--teal) 0%,var(--teal-d) 100%)}
    .rc-status.partial{background:linear-gradient(135deg,#d6a419 0%,#a9781f 100%)}
    .rc-status.due{background:linear-gradient(135deg,#c0392b 0%,#8f2318 100%)}

    /* Verify / QR tile — solid white field, quiet zone, high contrast */
    .rc-verify{border:1px solid var(--line);border-radius:10px;background:#fff;text-align:center;
      padding:12px 12px 10px;box-shadow:0 3px 10px rgba(11,26,22,.06)}
    .rc-qr{width:138px;height:138px;margin:0 auto;line-height:0}
    .rc-qr svg{width:100%;height:100%;display:block}
    .rc-vk{margin-top:9px;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--teal-d)}
    .rc-vn{margin-top:2px;font-size:8px;color:var(--muted);line-height:1.4}

    @media print{.rc-summary,.rc-verify{box-shadow:none}}
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
