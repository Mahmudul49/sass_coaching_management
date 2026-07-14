/**
 * Browser-side Excel helpers (SheetJS). Used by client components only.
 *
 * PERF: `xlsx` is one of the largest deps in the app (~1MB raw). It is imported
 * LAZILY (`await import("xlsx")`) inside each helper so it is code-split into its
 * own chunk and only downloaded when the user actually exports/imports — instead
 * of being bundled into the initial JS of every route that renders an export
 * button (students, payments, reports, results, attendance). All helpers are
 * therefore async; every call site invokes them from an event handler, so the
 * extra microtask is invisible to the user.
 */

export const STUDENT_COLUMNS = ["Name", "Roll", "Phone", "Class", "Section"] as const;

export type RawStudentRow = {
  Name?: string;
  Roll?: string | number;
  Phone?: string | number;
  Class?: string;
  Section?: string;
};

/** Trigger a download of a blank student-import template (.xlsx). */
export async function downloadStudentTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const sample = [
    { Name: "রহিম উদ্দিন", Roll: "101", Phone: "01700000000", Class: "Class 6", Section: "A" },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, { header: [...STUDENT_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "students-template.xlsx");
}

/** Parse an uploaded .xlsx/.csv File into raw rows. */
export async function parseStudentsExcel(file: File): Promise<RawStudentRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<RawStudentRow>(sheet, { defval: "" });
}

/** Export arbitrary rows (already plain objects) to a downloadable .xlsx. */
export async function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = "Sheet1"
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/**
 * Export a raw array-of-arrays as a sheet — used for bank-style collection
 * layouts (a title/meta header block followed by a table), e.g. the DBBL
 * Tuition Fee Collection format.
 */
export async function exportAoa(
  filename: string,
  aoa: (string | number)[][],
  sheetName = "DEPS"
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
