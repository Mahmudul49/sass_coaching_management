/**
 * On-demand academic transcript (report card) — browser-print, ONE A4 LANDSCAPE
 * page per student. Opens a self-contained styled document (the user Saves as
 * PDF from the print dialog); nothing is precomputed or stored server-side.
 *
 * Aesthetic: refined institutional / luxury diploma — warm ivory paper, an
 * engraved double frame with corner diamonds, a Playfair Display masthead paired
 * with Archivo, gold hairlines, a hero GPA medallion and a wax-seal signature.
 * `print-color-adjust: exact` keeps the teal/gold fills when printed, and the
 * document waits for webfonts (`document.fonts.ready`) before invoking print so
 * the type is never captured mid-swap.
 */

export type TranscriptSubjectLine = {
  sl: number;
  name: string;
  fullMarks: number;
  obtained: number;
  highest: number;
  point: number;
  grade: string;
};

export type TranscriptData = {
  centerName: string;
  title: string; // e.g. "Half Yearly Academic Transcript - 2026"
  examName: string;
  grading: { range: string; grade: string; point: number }[];
  studentName: string;
  roll: string;
  className: string;
  sectionName: string;
  subjects: TranscriptSubjectLine[];
  grandTotal: number;
  fullTotal: number;
  percentage: number;
  gpa: number;
  overallGrade: string;
  passed: boolean;
  rankClass: number;
  classCount: number;
};

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/** 1 → "1st", 2 → "2nd" … for the merit position. */
function ordinal(n: number): string {
  if (n <= 0) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export type TranscriptOrientation = "portrait" | "landscape";

/** One luxury A4 transcript page (landscape by default, portrait on request). */
function transcriptPage(d: TranscriptData, orientation: TranscriptOrientation): string {
  const initial = escapeHtml((d.centerName || "?").trim().charAt(0).toUpperCase());

  const gradingRows = d.grading
    .map(
      (g) =>
        `<tr><td>${escapeHtml(g.range)}</td><td class="b">${escapeHtml(g.grade)}</td><td>${g.point.toFixed(
          2
        )}</td></tr>`
    )
    .join("");

  const subjectRows = d.subjects
    .map(
      (s) => `<tr>
        <td class="c dim">${String(s.sl).padStart(2, "0")}</td>
        <td class="subj">${escapeHtml(s.name)}</td>
        <td class="c n">${s.fullMarks}</td>
        <td class="c n">${s.obtained}</td>
        <td class="c n strong">${s.obtained}</td>
        <td class="c n">${s.highest}</td>
        <td class="c n">${s.point.toFixed(2)}</td>
        <td class="c"><span class="gpill">${escapeHtml(s.grade)}</span></td>
      </tr>`
    )
    .join("");

  return `<section class="sheet ${orientation}">
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <div class="watermark">${initial}</div>

      <header class="masthead">
        <div class="crest"><span class="crest-star">&#10022;</span><span class="crest-i">${initial}</span></div>
        <div class="titles">
          <div class="eyebrow">Official Academic Transcript</div>
          <h1>${escapeHtml(d.centerName)}</h1>
          <div class="flourish"><span></span><i>&#10070;</i><span></span></div>
          <div class="subtitle">${escapeHtml(d.title)}</div>
        </div>
        <div class="ribbon ${d.passed ? "pass" : "fail"}">
          <span class="ribbon-k">Result</span>
          <span class="ribbon-v">${d.passed ? "Passed" : "Not Passed"}</span>
        </div>
      </header>

      <div class="identity">
        <div class="idf grow"><label>Name of Student</label><b>${escapeHtml(d.studentName)}</b></div>
        <div class="idf"><label>Class</label><b>${escapeHtml(d.className)}</b></div>
        <div class="idf"><label>Section</label><b>${escapeHtml(d.sectionName)}</b></div>
        <div class="idf"><label>Roll No.</label><b>${escapeHtml(d.roll)}</b></div>
        <div class="idf grow"><label>Examination</label><b>${escapeHtml(d.examName)}</b></div>
      </div>

      <div class="body">
        <table class="marks">
          <thead>
            <tr>
              <th>SL</th><th class="subj">Name of Subjects</th><th>Full</th>
              <th>Written</th><th>Total</th><th>Highest</th><th>Point</th><th>Grade</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
          <tfoot>
            <tr class="grand">
              <td colspan="4">Grand Total</td>
              <td class="c n">${d.grandTotal}</td>
              <td class="c dim">/ ${d.fullTotal}</td>
              <td class="c" colspan="2">GPA&nbsp;<b>${d.gpa.toFixed(2)}</b></td>
            </tr>
          </tfoot>
        </table>

        <aside class="side">
          <div class="medallion">
            <div class="medal-ring">
              <span class="medal-k">Grade Point Average</span>
              <span class="medal-v">${d.gpa.toFixed(2)}</span>
              <span class="medal-g">${escapeHtml(d.overallGrade)}</span>
            </div>
          </div>

          <div class="statlist">
            <div><label>Total Marks</label><b>${d.grandTotal} / ${d.fullTotal}</b></div>
            <div><label>Percentage</label><b>${d.percentage}%</b></div>
            <div><label>Merit Position</label><b>${ordinal(d.rankClass)}</b></div>
            <div><label>Out of</label><b>${d.classCount}</b></div>
          </div>

          <table class="grading">
            <thead><tr><th>Marks</th><th>Grade</th><th>Point</th></tr></thead>
            <tbody>${gradingRows}</tbody>
          </table>
        </aside>
      </div>

      <footer class="foot">
        <div class="fineprint">
          <div class="fp-title">Computer-generated academic record</div>
          <div>Issued on ${escapeHtml(
            new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
          )}</div>
        </div>
        <div class="sig">
          <div class="wax">${initial}</div>
          <div class="sig-line"></div>
          <span>Authorised Signature</span>
        </div>
      </footer>
    </div>
  </section>`;
}

function transcriptDoc(pages: string, orientation: TranscriptOrientation): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Transcript</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Archivo:wght@400;500;600;700&display=swap');

  :root{
    --ink:#1b2a25; --muted:#657771;
    --teal:#0F7A6B; --teal-d:#0A5A4E; --teal-dd:#073f37;
    --gold:#B0872B; --gold-l:#E7D6A2; --gold-soft:#f3ecd6;
    --paper:#FCFBF6; --line:#dbe0da;
    --display:'Playfair Display',Georgia,'Times New Roman',serif;
    --script:'Cormorant Garamond',Georgia,serif;
    --sans:'Archivo','Segoe UI',system-ui,sans-serif;
  }
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:var(--sans);margin:0;color:var(--ink);background:#dfe3e0}

  /* A4, one page per student. Orientation class sizes the sheet. */
  .sheet{padding:6mm;margin:0 auto;page-break-after:always;overflow:hidden;background:var(--paper)}
  .sheet.landscape{width:297mm;height:210mm}
  .sheet.portrait{width:210mm;height:297mm}
  .frame{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden;
    padding:7mm 11mm 6mm;
    border:1.5px solid var(--teal);
    box-shadow:inset 0 0 0 4px var(--paper), inset 0 0 0 5px var(--gold);
    background:
      radial-gradient(150% 80% at 50% -25%, rgba(15,122,107,.055), transparent 62%),
      radial-gradient(120% 60% at 50% 120%, rgba(176,135,43,.06), transparent 60%),
      repeating-linear-gradient(45deg, rgba(176,135,43,.022) 0 1px, transparent 1px 11px),
      repeating-linear-gradient(-45deg, rgba(15,122,107,.018) 0 1px, transparent 1px 11px),
      var(--paper)}
  .frame>*{position:relative;z-index:1}

  .corner{position:absolute;width:11px;height:11px;background:var(--gold);z-index:2;
    transform:rotate(45deg);opacity:.85}
  .corner.tl{top:7px;left:7px} .corner.tr{top:7px;right:7px}
  .corner.bl{bottom:7px;left:7px} .corner.br{bottom:7px;right:7px}

  .watermark{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--display);
    font-size:330px;font-weight:900;color:rgba(15,122,107,.045);pointer-events:none;user-select:none;z-index:0}

  /* ── Masthead ─────────────────────────────────────────── */
  .masthead{display:flex;align-items:center;gap:18px;padding-bottom:9px;
    border-bottom:2px solid var(--teal);position:relative}
  .masthead::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:1px;background:var(--gold);opacity:.55}
  .crest{width:64px;height:64px;border-radius:50%;flex:none;position:relative;display:grid;place-items:center;
    background:radial-gradient(circle at 32% 28%,#fff,#e6efec);
    border:2px solid var(--teal);box-shadow:0 0 0 3px var(--paper),0 0 0 4px var(--gold),0 3px 8px rgba(0,0,0,.14)}
  .crest-i{font-family:var(--display);font-weight:800;font-size:30px;color:var(--teal-d);line-height:1}
  .crest-star{position:absolute;top:5px;font-size:9px;color:var(--gold)}
  .titles{flex:1;text-align:center}
  .eyebrow{font-family:var(--sans);font-size:9.5px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-left:.42em}
  .titles h1{font-family:var(--display);font-weight:800;margin:3px 0 0;font-size:29px;color:var(--teal-d);letter-spacing:.005em;line-height:1.04}
  .flourish{display:flex;align-items:center;justify-content:center;gap:9px;margin:4px auto 0;max-width:300px;color:var(--gold)}
  .flourish span{height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .flourish i{font-style:normal;font-size:11px}
  .subtitle{font-family:var(--script);font-style:italic;font-size:16px;color:#3d4d47;margin-top:3px;font-weight:600}
  .ribbon{flex:none;text-align:center;border-radius:8px;padding:8px 15px;min-width:96px;
    border:1.5px solid;background:#fff}
  .ribbon-k{display:block;font-size:8px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:var(--muted)}
  .ribbon-v{display:block;font-family:var(--display);font-weight:800;font-size:16px;line-height:1.2;margin-top:1px}
  .ribbon.pass{border-color:#15925A88} .ribbon.pass .ribbon-v{color:#0f6b45}
  .ribbon.fail{border-color:#DC262688} .ribbon.fail .ribbon-v{color:#b02020}

  /* ── Identity band ────────────────────────────────────── */
  .identity{display:flex;margin-top:11px;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);
    background:linear-gradient(#fff,#fbf9f1)}
  .idf{padding:7px 15px;border-right:1px solid var(--line);flex:none;min-width:92px}
  .idf.grow{flex:1;min-width:0}
  .idf:last-child{border-right:0}
  .idf label{display:block;font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .idf b{font-family:var(--script);font-size:17px;font-weight:600;color:var(--ink);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* ── Body: marks + sidebar ────────────────────────────── */
  .body{display:flex;gap:16px;margin-top:10px;flex:1;align-items:stretch;min-height:0}
  .marks{border-collapse:collapse;width:100%;font-size:12.5px;flex:1;align-self:flex-start}
  .marks th,.marks td{border-bottom:1px solid var(--line);padding:7px 9px}
  .marks thead th{background:var(--teal);color:#fff;font-weight:600;text-align:center;font-size:9.5px;
    letter-spacing:.1em;text-transform:uppercase;border-bottom:2px solid var(--gold);padding:8px 6px}
  .marks thead th.subj{text-align:left}
  .marks .subj{text-align:left;min-width:150px;font-family:var(--script);font-size:15px;font-weight:600}
  .marks td.c{text-align:center}
  .marks td.n{font-variant-numeric:tabular-nums}
  .marks td.dim{color:var(--muted)}
  .marks td.strong{font-weight:800;color:var(--teal-d)}
  .marks tbody tr:nth-child(even){background:rgba(15,122,107,.035)}
  .gpill{display:inline-block;min-width:30px;font-weight:800;font-size:11px;color:var(--teal-d);
    background:var(--gold-soft);border:1px solid var(--gold-l);border-radius:999px;padding:1px 8px}
  .marks tfoot .grand td{background:var(--gold-soft);font-weight:800;color:var(--teal-d);font-size:13px;
    border-top:2px solid var(--gold);border-bottom:none;padding:9px}
  .marks tfoot .grand td:first-child{letter-spacing:.06em;text-transform:uppercase;font-size:11px}

  .side{width:236px;flex:none;display:flex;flex-direction:column;gap:11px}
  .medallion{display:flex;justify-content:center}
  .medal-ring{width:138px;height:138px;border-radius:50%;text-align:center;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 34%,#fff,#f5efdd);
    border:2px solid var(--gold);box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 6px var(--gold-l),0 4px 12px rgba(0,0,0,.08)}
  .medal-k{font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:#9a7d1f;font-weight:700;max-width:96px;line-height:1.3}
  .medal-v{font-family:var(--display);font-size:42px;font-weight:800;color:var(--teal-d);line-height:.98;margin-top:2px}
  .medal-g{margin-top:3px;font-weight:800;font-size:12px;color:#fff;background:var(--teal);border-radius:999px;padding:2px 16px;letter-spacing:.04em}

  .statlist{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
  .statlist>div{display:flex;justify-content:space-between;align-items:center;padding:6.5px 11px;border-bottom:1px solid var(--line)}
  .statlist>div:last-child{border-bottom:0}
  .statlist label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .statlist b{font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}

  .grading{border-collapse:collapse;width:100%;font-size:9.5px}
  .grading th,.grading td{border:1px solid #cdd6cf;padding:2.5px 6px;text-align:center}
  .grading thead th{background:var(--teal-d);color:#fff;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:8.5px;border-color:var(--teal-dd)}
  .grading tbody tr:nth-child(even){background:rgba(15,122,107,.05)}
  .grading td.b{font-weight:800;color:var(--teal-d)}

  /* ── Footer ───────────────────────────────────────────── */
  .foot{margin-top:7px;display:flex;justify-content:space-between;align-items:flex-end;
    padding-top:7px;border-top:1px solid var(--gold)}
  .fineprint{font-size:9.5px;color:var(--muted);line-height:1.5}
  .fineprint .fp-title{font-family:var(--script);font-style:italic;font-size:12px;color:#556;font-weight:600}
  .sig{text-align:center;position:relative}
  .sig .wax{position:absolute;left:50%;top:-34px;transform:translateX(-50%) rotate(-9deg);
    width:44px;height:44px;border-radius:50%;font-family:var(--display);font-weight:800;font-size:18px;
    display:grid;place-items:center;color:#fff;
    background:radial-gradient(circle at 34% 30%,#c99a3a,var(--gold));
    box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 2px 5px rgba(0,0,0,.2);opacity:.95}
  .sig .sig-line{width:210px;border-top:1.5px solid var(--ink);margin:0 auto 4px}
  .sig span{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#3d4d47}

  .toolbar{position:fixed;top:10px;right:10px;z-index:99}
  .toolbar button{background:var(--teal);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer;font-family:var(--sans);font-weight:600}
  /* Portrait reflow: the sheet is taller than wide, so stack the marks table
     over a horizontal summary strip (medallion · stats · grading key). */
  .sheet.portrait .body{flex-direction:column;gap:14px}
  .sheet.portrait .marks{flex:none;align-self:stretch;width:100%}
  .sheet.portrait .side{width:100%;flex-direction:row;gap:14px;align-items:stretch}
  .sheet.portrait .side>*{flex:1;min-width:0}
  .sheet.portrait .medallion{align-items:center}

  @media print{.toolbar{display:none}body{background:#fff}.sheet{margin:0;padding:0}}
  @page{size:A4 ${orientation};margin:0}
</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${pages}
  <script>
    (function(){
      function go(){ try{ window.focus(); window.print(); }catch(e){} }
      // Wait for the webfonts to settle so type isn't captured mid-swap; fonts.ready
      // resolves even if the fonts fail to load, so this can never hang.
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ setTimeout(go, 120); });
      else setTimeout(go, 700);
    })();
  </script>
</body></html>`;
}

/** Build the full printable HTML document for one or more transcripts. */
export function buildTranscriptDoc(
  list: TranscriptData[],
  orientation: TranscriptOrientation = "landscape"
): string {
  return transcriptDoc(list.map((d) => transcriptPage(d, orientation)).join(""), orientation);
}

function openDoc(html: string) {
  const w = window.open("", "_blank", "width=1180,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  // Printing is triggered inside the document once webfonts are ready.
}

/** Print a single student's transcript. */
export function printTranscript(d: TranscriptData, orientation: TranscriptOrientation = "landscape") {
  openDoc(buildTranscriptDoc([d], orientation));
}

/** Print one multi-page document (one A4 page per student) for a bulk export. */
export function printTranscripts(list: TranscriptData[], orientation: TranscriptOrientation = "landscape") {
  if (list.length === 0) return;
  openDoc(buildTranscriptDoc(list, orientation));
}
