/**
 * Reusable building blocks for branded print documents. Every printable in the
 * app composes these helpers over the shared theme (lib/print/theme.ts) so the
 * receipt, reports, student ID card, admit card and admission form all share one
 * professional visual language. Pure string builders — no DOM, no framework — so
 * they run in the sandboxed print window and are unit-testable.
 */
import { baseCss, PRINT_BOOTSTRAP } from "./theme";
import { qrSvg } from "./qr";

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/** Circular crest — the institution logo if supplied, else its monogram. */
export function crest(centerName: string, logoUrl?: string): string {
  if (logoUrl) return `<div class="crest"><img src="${escapeHtml(logoUrl)}" alt=""></div>`;
  const initial = escapeHtml((centerName || "?").trim().charAt(0).toUpperCase());
  return `<div class="crest"><span class="crest-i">${initial}</span></div>`;
}

/** Branded masthead: crest + eyebrow + institution name + document subtitle. */
export function brandHeader(opts: {
  centerName: string;
  eyebrow?: string;
  subtitle?: string;
  logoUrl?: string;
  badge?: { label: string; value: string };
}): string {
  const { centerName, eyebrow, subtitle, logoUrl, badge } = opts;
  return `<header class="masthead">
    ${crest(centerName, logoUrl)}
    <div class="titles">
      ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
      <h1>${escapeHtml(centerName)}</h1>
      <div class="flourish"><span></span><i>&#10070;</i><span></span></div>
      ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
    </div>
    ${
      badge
        ? `<div class="badge"><span class="badge-k">${escapeHtml(badge.label)}</span><span class="badge-v">${escapeHtml(
            badge.value
          )}</span></div>`
        : ""
    }
  </header>`;
}

/** Horizontal label/value identity band (student name, class, roll, …). */
export function metaGrid(items: { label: string; value: string; grow?: boolean }[]): string {
  return `<div class="metagrid">${items
    .map(
      (m) =>
        `<div class="mf${m.grow ? " grow" : ""}"><label>${escapeHtml(m.label)}</label><b>${escapeHtml(
          m.value
        )}</b></div>`
    )
    .join("")}</div>`;
}

/** A branded data table. Columns from `numericFrom` onward are right-aligned. */
export function dataTable(opts: {
  head: string[];
  rows: (string | number)[][];
  numericFrom?: number;
  footer?: (string | number)[];
}): string {
  const { head, rows, numericFrom = head.length, footer } = opts;
  const cls = (i: number) => (i >= numericFrom ? ' class="r"' : "");
  const thead = head.map((h, i) => `<th${cls(i)}>${escapeHtml(h)}</th>`).join("");
  const tbody = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  const tfoot = footer
    ? `<tfoot><tr>${footer.map((c, i) => `<td${cls(i)}>${escapeHtml(c)}</td>`).join("")}</tr></tfoot>`
    : "";
  return `<table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>`;
}

/** A signature line with a printed label underneath. */
export function signature(label: string): string {
  return `<div class="sig"><div class="line"></div><span>${escapeHtml(label)}</span></div>`;
}

/** QR verification badge (SVG rendered inline). `caption` describes what it proves. */
export function qrBadge(text: string, caption?: { title: string; note: string }): string {
  const svg = qrSvg(text, { size: 88, dark: "#101820" });
  return `<div class="qr"><div class="qr-img">${svg}</div>${
    caption
      ? `<div class="qr-cap"><b>${escapeHtml(caption.title)}</b>${escapeHtml(caption.note)}</div>`
      : ""
  }</div>`;
}

/** Standard document footer: a fineprint note on the left, issue date on the right. */
export function docFooter(note: string): string {
  const date = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<footer class="docfoot"><span class="fp-title">${escapeHtml(
    note
  )}</span><span>Issued ${escapeHtml(date)}</span></footer>`;
}

/**
 * Wrap body HTML in a complete, self-printing HTML document with the shared
 * theme. `framed` wraps the body in the engraved A4 frame (single-page docs like
 * the receipt / ID card); leave it off for flowing multi-page report tables.
 */
export function renderPrintDoc(opts: {
  title: string;
  body: string;
  orientation?: "portrait" | "landscape";
  framed?: boolean;
  extraCss?: string;
}): string {
  const { title, body, orientation = "portrait", framed = false, extraCss = "" } = opts;
  const inner = framed
    ? `<div class="sheet ${orientation}"><div class="frame"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>${body}</div></div>`
    : `<div class="sheet ${orientation}">${body}</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>${baseCss(orientation)}${extraCss}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${inner}
  ${PRINT_BOOTSTRAP}
</body></html>`;
}

/** Open a print document in a new window (printing auto-fires once fonts load). */
export function openPrintWindow(html: string, width = 900, height = 900): void {
  const w = window.open("", "_blank", `width=${width},height=${height}`);
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}
