"use client";
import { useState, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
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
import {
  downloadStudentTemplate,
  parseStudentsExcel,
  type RawStudentRow,
} from "@/lib/excel";
import { importStudentsFromExcel, type ExcelStudentRow } from "@/app/admin/actions/students";
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

      if (!name) errors.push("নাম নেই");
      if (!roll) errors.push("রোল নেই");
      if (!phone) errors.push("ফোন নেই");
      if (!className) errors.push("ক্লাস নেই");
      if (!sectionName) errors.push("শাখা নেই");

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
        setFileError("ফাইলে কোনো সারি পাওয়া যায়নি।");
        setRows([]);
        return;
      }
      setRows(validate(raw));
    } catch {
      setFileError("ফাইলটি পড়া যায়নি — সঠিক .xlsx ফাইল আপলোড করুন।");
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
        if (res.classesCreated) extra.push(`${toBnDigits(res.classesCreated)} টি নতুন ক্লাস`);
        if (res.sectionsCreated) extra.push(`${toBnDigits(res.sectionsCreated)} টি নতুন শাখা`);
        toast.success(
          `${toBnDigits(res.inserted)} জন ছাত্র যোগ হয়েছে।` +
            (extra.length ? ` (${extra.join(", ")} তৈরি হয়েছে)` : "")
        );
        handleClose();
      } else {
        toast.error(res.error ?? "ইম্পোর্ট ব্যর্থ হয়েছে।");
      }
    });
  }

  function handleClose() {
    setRows([]);
    setFileError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={pending ? undefined : handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Excel দিয়ে ছাত্র যোগ করুন</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            কলাম: <b>Name, Roll, Phone, Class, Section</b>. কোনো ক্লাস বা শাখা আগে
            থেকে না থাকলে ইম্পোর্টের সময় <b>স্বয়ংক্রিয়ভাবে তৈরি</b> হয়ে যাবে।
          </Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadStudentTemplate}>
              টেমপ্লেট ডাউনলোড
            </Button>
            <Button component="label" startIcon={<UploadFileIcon />}>
              ফাইল নির্বাচন করুন
              <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={onFile} />
            </Button>
          </Stack>

          {fileError && <Alert severity="error">{fileError}</Alert>}

          {rows.length > 0 && (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color="success" label={`বৈধ: ${toBnDigits(validRows.length)}`} />
                {invalidCount > 0 && (
                  <Chip color="error" label={`ত্রুটি: ${toBnDigits(invalidCount)}`} />
                )}
                {newClassCount > 0 && (
                  <Chip color="info" label={`নতুন ক্লাস তৈরি হবে: ${toBnDigits(newClassCount)}`} />
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
                      <TableCell>অবস্থা</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.rowNo}
                        sx={r.errors.length ? { bgcolor: "error.light", opacity: 0.95 } : undefined}
                      >
                        <TableCell>{toBnDigits(r.rowNo)}</TableCell>
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
                              label={r.newClass ? "নতুন ক্লাস+শাখা" : "নতুন শাখা"}
                            />
                          ) : (
                            <Chip size="small" color="success" label="ঠিক আছে" />
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
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="text" color="inherit" onClick={handleClose} disabled={pending}>
          বাতিল
        </Button>
        <Button onClick={confirmImport} disabled={pending || validRows.length === 0}>
          {pending ? "ইম্পোর্ট হচ্ছে..." : `${toBnDigits(validRows.length)} জন ইম্পোর্ট করুন`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
