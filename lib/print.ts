import { toBnDigits } from "@/lib/format";

/**
 * Open a clean, professional printable document (table) in a new window and
 * trigger the browser print dialog — users "Save as PDF" from there. Consistent
 * A4-friendly styling, Bengali-capable font, header/meta block + footer.
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
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
    );

  const thead = head
    .map((h, i) => `<th style="text-align:${i >= numericFrom ? "right" : "left"}">${esc(h)}</th>`)
    .join("");
  const tbody = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td style="text-align:${i >= numericFrom ? "right" : "left"}">${esc(c)}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const today = new Date();
  const dateStr = toBnDigits(
    `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`
  );

  const w = window.open("", "_blank", "width=1000,height=720");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8">
<title>${esc(subtitle || title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Hind Siliguri','Noto Sans Bengali',system-ui,sans-serif;color:#12241F;padding:24px;margin:0}
  header{border-bottom:2px solid #0F7A6B;padding-bottom:10px;margin-bottom:14px}
  h1{font-size:20px;margin:0;color:#0F7A6B}
  h2{font-size:14px;margin:2px 0 0;font-weight:600;color:#334}
  .meta{font-size:12px;color:#556;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #d7ddda;padding:6px 8px}
  th{background:#0F7A6B14;font-weight:700}
  tbody tr:nth-child(even){background:#0F7A6B08}
  footer{margin-top:16px;display:flex;justify-content:space-between;font-size:11px;color:#889}
  .toolbar{text-align:center;margin-top:18px}
  button{background:#0F7A6B;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer;font-family:inherit}
  @media print{.toolbar{display:none}body{padding:0}}
</style></head><body>
  <header>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<h2>${esc(subtitle)}</h2>` : ""}
    ${meta.map((m) => `<div class="meta">${esc(m)}</div>`).join("")}
  </header>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <footer><span>মোট: ${toBnDigits(rows.length)} সারি</span><span>তারিখ: ${dateStr}</span></footer>
  <div class="toolbar"><button onclick="window.print()">প্রিন্ট / PDF সংরক্ষণ</button></div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
