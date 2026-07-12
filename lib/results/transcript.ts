/**
 * On-demand academic transcript (report card) — browser-print, one A4 page per
 * student, same approach as `lib/print.ts` (open styled HTML, user Saves as PDF).
 * Nothing is precomputed or stored: transcripts are built in the browser only
 * for the students the admin picks. "Premium" report-card layout: ornamental
 * frame + watermark seal, a grading key, a subject marks table (with each
 * subject's class-highest), grand total + percentage + GPA, merit position in
 * class, and a single Authorised Signature.
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

/** One premium A4-portrait transcript page. */
function transcriptPage(d: TranscriptData): string {
  const initial = escapeHtml((d.centerName || "?").trim().charAt(0).toUpperCase());

  const gradingRows = d.grading
    .map(
      (g) =>
        `<tr><td>${escapeHtml(g.range)}</td><td>${escapeHtml(g.grade)}</td><td>${g.point.toFixed(
          2
        )}</td></tr>`
    )
    .join("");

  const subjectRows = d.subjects
    .map(
      (s) => `<tr>
        <td class="c">${s.sl}</td>
        <td class="subj">${escapeHtml(s.name)}</td>
        <td class="c">${s.fullMarks}</td>
        <td class="c">${s.obtained}</td>
        <td class="c">${s.obtained}</td>
        <td class="c">${s.highest}</td>
        <td class="c">${s.point.toFixed(2)}</td>
        <td class="c b">${escapeHtml(s.grade)}</td>
      </tr>`
    )
    .join("");

  return `<section class="sheet">
    <div class="frame">
      <div class="watermark">${initial}</div>

      <header class="top">
        <div class="crest">${initial}</div>
        <div class="titles">
          <div class="eyebrow">Official Academic Record</div>
          <h1>${escapeHtml(d.centerName)}</h1>
          <div class="rule"><span></span><i>&#10022;</i><span></span></div>
          <h2>${escapeHtml(d.title)}</h2>
        </div>
        <table class="grading">
          <thead>
            <tr><th colspan="3">Grading Scale</th></tr>
            <tr><th>Marks</th><th>Grade</th><th>Point</th></tr>
          </thead>
          <tbody>${gradingRows}</tbody>
        </table>
      </header>

      <div class="whoband">
        <div><label>Name</label><b>${escapeHtml(d.studentName)}</b></div>
        <div><label>Class</label><b>${escapeHtml(d.className)}</b></div>
        <div><label>Section</label><b>${escapeHtml(d.sectionName)}</b></div>
        <div><label>Roll</label><b>${escapeHtml(d.roll)}</b></div>
      </div>
      <div class="examline">Examination : <b>${escapeHtml(d.examName)}</b></div>

      <div class="body">
        <table class="marks">
          <thead>
            <tr>
              <th>SL</th><th class="subj">Name of Subjects</th><th>Full<br>Marks</th>
              <th>Written</th><th>Total</th><th>Highest<br>Marks</th><th>Grade<br>Point</th><th>Letter<br>Grade</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
          <tfoot>
            <tr class="grand">
              <td colspan="3">Grand Total</td>
              <td class="c" colspan="3">${d.grandTotal} / ${d.fullTotal}</td>
              <td class="c" colspan="2">GPA ${d.gpa.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <aside class="panel">
          <div class="gpaBadge">
            <span class="lbl">GPA</span>
            <span class="val">${d.gpa.toFixed(2)}</span>
            <span class="grade">${escapeHtml(d.overallGrade)}</span>
          </div>
          <table class="info">
            <tr><td>Total Marks</td><td>${d.grandTotal} / ${d.fullTotal}</td></tr>
            <tr><td>Percentage</td><td>${d.percentage}%</td></tr>
            <tr><td>Merit Position</td><td>${ordinal(d.rankClass)}</td></tr>
            <tr><td>Out of</td><td>${d.classCount}</td></tr>
          </table>
          <div class="result ${d.passed ? "pass" : "fail"}">${d.passed ? "PASSED" : "NOT PASSED"}</div>
        </aside>
      </div>

      <footer class="foot">
        <div class="issued">Issued on ${escapeHtml(
          new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        )}</div>
        <div class="sig">
          <div class="seal">${initial}</div>
          <div class="line"></div>
          <span>Authorised Signature</span>
        </div>
      </footer>
    </div>
  </section>`;
}

function transcriptDoc(pages: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Transcript</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Hind Siliguri','Noto Sans Bengali',system-ui,sans-serif;margin:0;color:#1a2b26;background:#e9ecea}
  .serif{font-family:Georgia,'Times New Roman',serif}
  .sheet{width:210mm;min-height:296mm;padding:8mm;background:#fff;margin:0 auto;page-break-after:always}
  .frame{position:relative;height:100%;min-height:280mm;border:2px solid #0F7A6B;outline:1px solid #C9A227;outline-offset:4px;
    padding:14mm 12mm 10mm;display:flex;flex-direction:column;overflow:hidden;
    background:
      radial-gradient(120% 60% at 50% -10%, rgba(15,122,107,.06), transparent 60%),
      radial-gradient(90% 50% at 50% 110%, rgba(201,162,39,.06), transparent 60%)}
  .watermark{position:absolute;inset:0;display:grid;place-items:center;font-family:Georgia,serif;font-size:340px;font-weight:800;
    color:rgba(15,122,107,.045);pointer-events:none;user-select:none;z-index:0}
  .frame>*{position:relative;z-index:1}

  .top{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid #0F7A6B;padding-bottom:10px}
  .crest{width:60px;height:60px;border-radius:50%;flex:none;display:grid;place-items:center;font-family:Georgia,serif;
    font-weight:800;font-size:30px;color:#0A5A4E;background:radial-gradient(circle at 30% 30%,#fff,#e7f1ee);
    border:2px solid #C9A227;box-shadow:0 2px 6px rgba(0,0,0,.12)}
  .titles{flex:1;text-align:center}
  .eyebrow{font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:#C9A227;font-weight:700}
  .titles h1{font-family:Georgia,'Times New Roman',serif;margin:3px 0 0;font-size:25px;color:#0A5A4E;letter-spacing:.01em}
  .titles h2{margin:4px 0 0;font-size:12.5px;font-weight:600;color:#425}
  .rule{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px auto 0;max-width:260px;color:#C9A227}
  .rule span{height:1px;flex:1;background:linear-gradient(90deg,transparent,#C9A227,transparent)}
  .rule i{font-style:normal;font-size:11px}

  .grading{border-collapse:collapse;font-size:8.5px;flex:none}
  .grading th,.grading td{border:1px solid #b6c4bf;padding:1.5px 6px;text-align:center}
  .grading thead th{background:#0F7A6B;color:#fff;font-weight:700;border-color:#0F7A6B}
  .grading tbody tr:nth-child(even){background:#0F7A6B0a}

  .whoband{display:flex;gap:0;margin-top:12px;border:1px solid #cfd9d5;border-radius:8px;overflow:hidden}
  .whoband>div{flex:1;padding:7px 12px;border-right:1px solid #e3e9e6}
  .whoband>div:last-child{border-right:0;flex:none;min-width:70px}
  .whoband label{display:block;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#7c8a84;font-weight:700}
  .whoband b{font-size:13px}
  .examline{margin-top:8px;font-size:12px;color:#334}

  .body{display:flex;gap:12px;margin-top:12px;flex:1;align-items:flex-start}
  .marks{border-collapse:collapse;width:100%;font-size:11.5px;flex:1}
  .marks th,.marks td{border:1px solid #c4cec9;padding:5px 6px}
  .marks thead th{background:#0F7A6B;color:#fff;font-weight:700;text-align:center;line-height:1.15;border-color:#0d6a5d}
  .marks .subj{text-align:left;min-width:118px}
  .marks tbody tr:nth-child(even){background:#0F7A6B08}
  .marks td.c{text-align:center}
  .marks td.b{font-weight:700;color:#0A5A4E}
  .marks tfoot .grand td{background:#C9A22718;font-weight:800;color:#0A5A4E;border-color:#C9A227}

  .panel{width:172px;flex:none;display:flex;flex-direction:column;gap:10px}
  .gpaBadge{border:2px solid #C9A227;border-radius:12px;text-align:center;padding:10px 6px;
    background:radial-gradient(circle at 50% 0%,#fff,#f6f2e4)}
  .gpaBadge .lbl{display:block;font-size:9px;letter-spacing:.2em;color:#9a7d1f;font-weight:700}
  .gpaBadge .val{display:block;font-family:Georgia,serif;font-size:34px;font-weight:800;color:#0A5A4E;line-height:1.05}
  .gpaBadge .grade{display:inline-block;margin-top:3px;font-size:12px;font-weight:800;color:#fff;background:#0F7A6B;border-radius:999px;padding:1px 12px}
  .info{width:100%;border-collapse:collapse;font-size:11.5px}
  .info td{border:1px solid #c4cec9;padding:5px 8px}
  .info td:first-child{color:#556;background:#0F7A6B08}
  .info td:last-child{text-align:right;font-weight:700}
  .result{text-align:center;font-weight:800;letter-spacing:.14em;border-radius:8px;padding:7px}
  .result.pass{color:#0f6b45;background:#15925A16;border:1px solid #15925A66}
  .result.fail{color:#b02020;background:#DC262616;border:1px solid #DC262666}

  .foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-top:22px}
  .issued{font-size:10px;color:#889}
  .sig{text-align:center;position:relative}
  .sig .seal{position:absolute;left:50%;top:-30px;transform:translateX(-50%) rotate(-10deg);
    width:44px;height:44px;border-radius:50%;border:2px dashed #C9A227;color:#C9A22799;font-family:Georgia,serif;
    font-weight:800;font-size:18px;display:grid;place-items:center;opacity:.85}
  .sig .line{width:190px;border-top:1.5px solid #334;margin:0 auto 4px}
  .sig span{font-size:11px;font-weight:600;color:#445}

  .toolbar{position:fixed;top:10px;right:10px}
  .toolbar button{background:#0F7A6B;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer;font-family:inherit}
  @media print{.toolbar{display:none}body{background:#fff}.sheet{margin:0;min-height:auto;padding:6mm}}
  @page{size:A4 portrait;margin:0}
</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${pages}
</body></html>`;
}

/** Build the full printable HTML document for one or more transcripts. */
export function buildTranscriptDoc(list: TranscriptData[]): string {
  return transcriptDoc(list.map(transcriptPage).join(""));
}

function openDoc(html: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/** Print a single student's transcript. */
export function printTranscript(d: TranscriptData) {
  openDoc(buildTranscriptDoc([d]));
}

/** Print one multi-page document (one A4 page per student) for a bulk export. */
export function printTranscripts(list: TranscriptData[]) {
  if (list.length === 0) return;
  openDoc(buildTranscriptDoc(list));
}
