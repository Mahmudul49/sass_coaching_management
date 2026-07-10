"use client";
import { useState, useTransition } from "react";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  downloadStudentTemplate,
  parseStudentsExcel,
  type RawStudentRow,
} from "@/lib/excel";
import { importStudentsFromExcel, type ExcelStudentRow } from "@/app/[tenant]/admin/actions/students";
import { toBnDigits } from "@/lib/format";
import type { ClassRow, SectionRow } from "@/lib/admin/queries";

type PreviewRow = RawStudentRow & {
  rowNo: number;
  errors: string[];
  newClass: boolean;
  newSection: boolean;
};

export default function BulkImportDialog({
  open,
  onClose,
  classes,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassRow[];
  sections: SectionRow[];
}) {
  const toast = useToast();
  // Bilingual copy: follows the active language (English under the dashboard's
  // English provider, Bengali under the setup wizard / global toggle).
  const { locale } = useI18n();
  const en = locale === "en";
  const num = (v: string | number) => toBnDigits(v, locale);
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c]));

  function validate(raw: RawStudentRow[]): PreviewRow[] {
    return raw.map((r, i) => {
      const errors: string[] = [];
      const name = String(r.Name ?? "").trim();
      const roll = String(r.Roll ?? "").trim();
      const phone = String(r.Phone ?? "").trim();
      const className = String(r.Class ?? "").trim();
      const sectionName = String(r.Section ?? "").trim();

      if (!name) errors.push(en ? "Name missing" : "নাম নেই");
      if (!roll) errors.push(en ? "Roll missing" : "রোল নেই");
      if (!phone) errors.push(en ? "Phone missing" : "ফোন নেই");
      if (!className) errors.push(en ? "Class missing" : "ক্লাস নেই");
      // Section optional — no error when blank.

      // Unmatched class/section are NOT errors — they will be created on import.
      const cls = className ? classByName.get(className.toLowerCase()) : undefined;
      const newClass = !!className && !cls;
      const sectionExists =
        cls &&
        sections.some(
          (s) => s.classId === cls.id && s.name.trim().toLowerCase() === sectionName.toLowerCase()
        );
      const newSection = !!sectionName && !!className && !sectionExists;

      return { ...r, rowNo: i + 2, errors, newClass, newSection };
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const raw = await parseStudentsExcel(file);
      if (!raw.length) {
        setFileError(en ? "No rows found in the file." : "ফাইলে কোনো সারি পাওয়া যায়নি।");
        setRows([]);
        return;
      }
      setRows(validate(raw));
    } catch {
      setFileError(
        en
          ? "Couldn't read the file — please upload a valid .xlsx file."
          : "ফাইলটি পড়া যায়নি — সঠিক .xlsx ফাইল আপলোড করুন।"
      );
      setRows([]);
    }
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;
  const newClassCount = new Set(
    validRows.filter((r) => r.newClass).map((r) => String(r.Class).trim().toLowerCase())
  ).size;

  function confirmImport() {
    const payload: ExcelStudentRow[] = validRows.map((r) => ({
      name: String(r.Name).trim(),
      roll: String(r.Roll).trim(),
      phone: String(r.Phone).trim(),
      className: String(r.Class).trim(),
      sectionName: String(r.Section).trim(),
    }));
    start(async () => {
      const res = await importStudentsFromExcel(payload);
      if (res.ok) {
        const extra: string[] = [];
        if (res.classesCreated)
          extra.push(en ? `${res.classesCreated} new class(es)` : `${num(res.classesCreated)} টি নতুন ক্লাস`);
        if (res.sectionsCreated)
          extra.push(en ? `${res.sectionsCreated} new section(s)` : `${num(res.sectionsCreated)} টি নতুন শাখা`);
        toast.success(
          en
            ? `${res.inserted} student(s) added.` + (extra.length ? ` (${extra.join(", ")} created)` : "")
            : `${num(res.inserted)} জন শিক্ষার্থী যোগ হয়েছে।` +
                (extra.length ? ` (${extra.join(", ")} তৈরি হয়েছে)` : "")
        );
        handleClose();
      } else {
        toast.error(res.error ?? (en ? "Import failed." : "ইম্পোর্ট ব্যর্থ হয়েছে।"));
      }
    });
  }

  function handleClose() {
    setRows([]);
    setFileError(null);
    onClose();
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={handleClose}
      disableClose={pending}
      title={en ? "Add Students via Excel" : "Excel দিয়ে শিক্ষার্থী যোগ করুন"}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={handleClose} disabled={pending}>
            {en ? "Cancel" : "বাতিল"}
          </Button>
          <Button onClick={confirmImport} disabled={pending || validRows.length === 0}>
            {pending
              ? en
                ? "Importing..."
                : "ইম্পোর্ট হচ্ছে..."
              : en
                ? `Import ${validRows.length}`
                : `${num(validRows.length)} জন ইম্পোর্ট করুন`}
          </Button>
        </>
      }
    >
        <Stack spacing={2}>
          <Alert severity="info">
            {en ? (
              <>
                Columns: <b>Name, Roll, Phone, Class</b> and <b>Section (optional)</b>. Any class or
                section that doesn&apos;t already exist is <b>created automatically</b> during import.
              </>
            ) : (
              <>
                কলাম: <b>Name, Roll, Phone, Class</b> এবং <b>Section (ঐচ্ছিক)</b>। কোনো
                ক্লাস বা শাখা আগে থেকে না থাকলে ইম্পোর্টের সময় <b>স্বয়ংক্রিয়ভাবে তৈরি</b> হয়ে যাবে।
              </>
            )}
          </Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadStudentTemplate}>
              {en ? "Download Template" : "টেমপ্লেট ডাউনলোড"}
            </Button>
            <Button component="label" startIcon={<UploadFileIcon />}>
              {en ? "Choose File" : "ফাইল নির্বাচন করুন"}
              <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={onFile} />
            </Button>
          </Stack>

          {fileError && <Alert severity="error">{fileError}</Alert>}

          {rows.length > 0 && (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color="success" label={`${en ? "Valid" : "বৈধ"}: ${num(validRows.length)}`} />
                {invalidCount > 0 && (
                  <Chip color="error" label={`${en ? "Errors" : "ত্রুটি"}: ${num(invalidCount)}`} />
                )}
                {newClassCount > 0 && (
                  <Chip
                    color="info"
                    label={`${en ? "New classes to create" : "নতুন ক্লাস তৈরি হবে"}: ${num(newClassCount)}`}
                  />
                )}
              </Stack>
              <Box sx={{ maxHeight: 340, overflow: "auto", border: "1px solid #eee", borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Roll</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Section</TableCell>
                      <TableCell>{en ? "Status" : "অবস্থা"}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.rowNo}
                        sx={r.errors.length ? { bgcolor: "error.light", opacity: 0.95 } : undefined}
                      >
                        <TableCell>{num(r.rowNo)}</TableCell>
                        <TableCell>{String(r.Name ?? "")}</TableCell>
                        <TableCell>{String(r.Roll ?? "")}</TableCell>
                        <TableCell>{String(r.Phone ?? "")}</TableCell>
                        <TableCell>{String(r.Class ?? "")}</TableCell>
                        <TableCell>{String(r.Section ?? "")}</TableCell>
                        <TableCell>
                          {r.errors.length ? (
                            <Typography variant="caption" color="error">
                              {r.errors.join(", ")}
                            </Typography>
                          ) : r.newClass || r.newSection ? (
                            <Chip
                              size="small"
                              color="info"
                              label={
                                r.newClass
                                  ? en
                                    ? "New class + section"
                                    : "নতুন ক্লাস+শাখা"
                                  : en
                                    ? "New section"
                                    : "নতুন শাখা"
                              }
                            />
                          ) : (
                            <Chip size="small" color="success" label={en ? "OK" : "ঠিক আছে"} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Stack>
    </ResponsiveDialog>
  );
}
