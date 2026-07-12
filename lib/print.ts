import { brandHeader, dataTable, docFooter, escapeHtml, openPrintWindow, renderPrintDoc } from "@/lib/print/document";

/**
 * Print a branded, professional report table (Save as PDF from the dialog).
 * Built on the shared print system (lib/print/*) so it matches the receipt,
 * transcript and ID card. Flowing layout — the table paginates naturally across
 * A4 pages. Signature preserved for backward compatibility with all callers.
 */
export function printReportTable(opts: {
  title: string; // main heading (e.g. center name)
  subtitle?: string; // report name
  meta?: string[]; // extra header lines (filters, date range)
  head: string[];
  rows: (string | number)[][];
  numericFrom?: number; // right-align columns from this index
}) {
  const { title, subtitle, meta = [], head, rows, numericFrom = head.length } = opts;

  const metaLine = meta.length
    ? `<div class="report-meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>`
    : "";

  const body = `
    ${brandHeader({ centerName: title, eyebrow: "Report", subtitle })}
    ${metaLine}
    ${dataTable({ head, rows, numericFrom })}
    ${docFooter(`Total ${rows.length} row${rows.length === 1 ? "" : "s"}`)}
  `;

  const extraCss = `
    .report-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px;font-size:11px;color:var(--muted)}
    .report-meta span{background:rgba(15,122,107,.06);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-weight:600}
    table.data thead th{position:sticky;top:0}
  `;

  const html = renderPrintDoc({ title: subtitle || title, body, orientation: "portrait", extraCss });
  openPrintWindow(html, 1000, 760);
}
