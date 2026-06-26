import * as XLSX from "xlsx";

/**
 * Browser-side Excel helpers (SheetJS). Used by client components only.
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
export function downloadStudentTemplate() {
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
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<RawStudentRow>(sheet, { defval: "" });
}

/** Export arbitrary rows (already plain objects) to a downloadable .xlsx. */
export function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = "Sheet1"
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
