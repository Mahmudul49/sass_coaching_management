/**
 * Shared visual language for every printable document (receipt, reports, student
 * ID card, admit card, admission form). One set of brand tokens + one base
 * stylesheet keeps all "Save as PDF" output consistent: warm ivory paper, an
 * engraved teal frame with a gold inset and corner diamonds, a Playfair Display
 * masthead paired with Archivo body text, and print-exact colour so the teal/gold
 * fills survive the print pipeline. Matches the flagship academic transcript.
 */

export const PRINT_TOKENS = {
  teal: "#0F7A6B",
  tealDark: "#0A5A4E",
  tealDeep: "#073f37",
  gold: "#B0872B",
  goldLight: "#E7D6A2",
  goldSoft: "#f3ecd6",
  paper: "#FCFBF6",
  ink: "#1b2a25",
  muted: "#657771",
  line: "#dbe0da",
  danger: "#b02020",
  display: "'Playfair Display',Georgia,'Times New Roman',serif",
  script: "'Cormorant Garamond',Georgia,serif",
  sans: "'Archivo','Segoe UI',system-ui,sans-serif",
} as const;

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Archivo:wght@400;500;600;700&display=swap');";

/**
 * Base stylesheet shared by all print documents. `orientation` sizes the page;
 * callers append their own component CSS for bespoke layouts.
 */
export function baseCss(orientation: "portrait" | "landscape" = "portrait"): string {
  return `${FONTS_IMPORT}
:root{
  --teal:${PRINT_TOKENS.teal};--teal-d:${PRINT_TOKENS.tealDark};--teal-dd:${PRINT_TOKENS.tealDeep};
  --gold:${PRINT_TOKENS.gold};--gold-l:${PRINT_TOKENS.goldLight};--gold-soft:${PRINT_TOKENS.goldSoft};
  --paper:${PRINT_TOKENS.paper};--ink:${PRINT_TOKENS.ink};--muted:${PRINT_TOKENS.muted};
  --line:${PRINT_TOKENS.line};--danger:${PRINT_TOKENS.danger};
  --display:${PRINT_TOKENS.display};--script:${PRINT_TOKENS.script};--sans:${PRINT_TOKENS.sans};
}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}
body{font-family:var(--sans),'Hind Siliguri','Noto Sans Bengali',sans-serif;color:var(--ink);background:#dfe3e0}

/* Sheet + engraved frame */
.sheet{background:var(--paper);margin:0 auto;page-break-after:always;position:relative}
.sheet.portrait{width:210mm;min-height:297mm;padding:10mm}
.sheet.landscape{width:297mm;min-height:210mm;padding:8mm}
.frame{position:relative;min-height:100%;padding:9mm 11mm;
  border:1.5px solid var(--teal);
  box-shadow:inset 0 0 0 4px var(--paper),inset 0 0 0 5px var(--gold);
  background:
    radial-gradient(140% 70% at 50% -20%,rgba(15,122,107,.05),transparent 60%),
    radial-gradient(120% 55% at 50% 118%,rgba(176,135,43,.05),transparent 58%),
    repeating-linear-gradient(45deg,rgba(176,135,43,.02) 0 1px,transparent 1px 12px),
    var(--paper)}
.corner{position:absolute;width:10px;height:10px;background:var(--gold);transform:rotate(45deg);opacity:.85;z-index:2}
.corner.tl{top:6px;left:6px}.corner.tr{top:6px;right:6px}.corner.bl{bottom:6px;left:6px}.corner.br{bottom:6px;right:6px}

/* Masthead */
.masthead{display:flex;align-items:center;gap:16px;padding-bottom:10px;border-bottom:2px solid var(--teal);position:relative}
.masthead::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:1px;background:var(--gold);opacity:.55}
.crest{width:58px;height:58px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(circle at 32% 28%,#fff,#e6efec);
  border:2px solid var(--teal);box-shadow:0 0 0 3px var(--paper),0 0 0 4px var(--gold),0 3px 8px rgba(0,0,0,.14)}
.crest img{width:100%;height:100%;object-fit:cover}
.crest-i{font-family:var(--display);font-weight:800;font-size:27px;color:var(--teal-d);line-height:1}
.titles{flex:1;text-align:center;min-width:0}
.eyebrow{font-size:9px;letter-spacing:.4em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-left:.4em}
.titles h1{font-family:var(--display);font-weight:800;margin:2px 0 0;font-size:25px;color:var(--teal-d);line-height:1.05}
.flourish{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px auto 0;max-width:280px;color:var(--gold)}
.flourish span{height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.flourish i{font-style:normal;font-size:10px}
.subtitle{font-family:var(--script);font-style:italic;font-size:15px;color:#3d4d47;margin-top:2px;font-weight:600}
.badge{flex:none;text-align:center;border-radius:8px;padding:7px 13px;min-width:88px;border:1.5px solid var(--gold);background:#fff}
.badge-k{display:block;font-size:8px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--muted)}
.badge-v{display:block;font-family:var(--display);font-weight:800;font-size:15px;line-height:1.2;margin-top:1px;color:var(--teal-d)}

/* Identity / meta grid */
.metagrid{display:flex;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);background:linear-gradient(#fff,#fbf9f1)}
.metagrid .mf{padding:7px 14px;border-right:1px solid var(--line);flex:none;min-width:96px}
.metagrid .mf.grow{flex:1;min-width:0}
.metagrid .mf:last-child{border-right:0}
.metagrid label{display:block;font-size:8px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:700}
.metagrid b{font-family:var(--script);font-size:16px;font-weight:600;color:var(--ink);line-height:1.15}

/* Data table */
table.data{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:12px}
table.data th,table.data td{border-bottom:1px solid var(--line);padding:7px 9px;text-align:left}
table.data thead th{background:var(--teal);color:#fff;font-weight:600;font-size:9.5px;letter-spacing:.09em;
  text-transform:uppercase;border-bottom:2px solid var(--gold);padding:8px 9px}
table.data td.r,table.data th.r{text-align:right;font-variant-numeric:tabular-nums}
table.data tbody tr:nth-child(even){background:rgba(15,122,107,.035)}
table.data tfoot td,table.data tr.total td{background:var(--gold-soft);font-weight:800;color:var(--teal-d);
  border-top:2px solid var(--gold);border-bottom:none}
.due{color:var(--danger)!important}

/* Signature + QR */
.sigrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;gap:20px}
.sig{text-align:center}
.sig .line{width:180px;border-top:1.5px solid var(--ink);margin:0 auto 4px}
.sig span{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3d4d47}
.qr{display:flex;align-items:center;gap:10px}
.qr .qr-img{width:96px;height:96px;flex:none;padding:5px;background:#fff;border:1px solid var(--line);border-radius:6px}
.qr .qr-cap{font-size:9px;color:var(--muted);max-width:150px;line-height:1.4}
.qr .qr-cap b{display:block;font-size:10px;color:var(--ink);text-transform:uppercase;letter-spacing:.08em}

/* Footer */
.docfoot{margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end;
  padding-top:8px;border-top:1px solid var(--gold);font-size:9.5px;color:var(--muted)}
.docfoot .fp-title{font-family:var(--script);font-style:italic;font-size:12px;color:#556;font-weight:600}

/* Toolbar (screen only) */
.toolbar{position:fixed;top:12px;right:12px;z-index:99}
.toolbar button{background:var(--teal);color:#fff;border:0;border-radius:8px;padding:10px 18px;
  font-size:14px;cursor:pointer;font-family:var(--sans);font-weight:600}
@media print{.toolbar{display:none}body{background:#fff}.sheet{margin:0;padding:0;min-height:auto}}
@page{size:A4 ${orientation};margin:8mm}`;
}

/**
 * Print bootstrap: waits for webfonts to settle so type is never captured
 * mid-swap, then opens the print dialog. `fonts.ready` resolves even on font
 * failure, so this can never hang.
 */
export const PRINT_BOOTSTRAP = `<script>(function(){function go(){try{window.focus();window.print();}catch(e){}}if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(go,120);});}else{setTimeout(go,700);}})();</script>`;
