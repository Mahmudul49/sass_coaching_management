"use client";
import { useMemo, useState, useTransition, useDeferredValue } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import { useToast } from "@/components/providers/ToastProvider";
import { loadResultsReport, type ReportFilter } from "@/app/[tenant]/admin/actions/results";
import { exportToExcel } from "@/lib/excel";
import { printReportTable } from "@/lib/print";
import type { ClassRow } from "@/lib/admin/queries";
import type { ExamRow, SubjectRow, ResultReportRow, ResultReport } from "@/lib/results/queries";

/**
 * Cross-exam results report. Filters (class/exam/subject/date/status) apply
 * IN PLACE via a server action (no reload), search is debounced with
 * `useDeferredValue`, the grid paginates, and export reuses the shared
 * Excel/print helpers. Data is computed-on-read and capped server-side.
 */
export default function ResultsReportClient({
  centerName,
  classes,
  subjects,
  exams,
  from: fromProp,
  to: toProp,
  initial,
}: {
  centerName: string;
  classes: ClassRow[];
  subjects: SubjectRow[];
  exams: ExamRow[];
  from: string;
  to: string;
  initial: ResultReport;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [from, setFrom] = useState(fromProp);
  const [to, setTo] = useState(toProp);
  const [rows, setRows] = useState<ResultReportRow[]>(initial.rows);
  const [capped, setCapped] = useState(initial.capped);
  const [q, setQ] = useState("");

  const deferredQ = useDeferredValue(q);
  const subjectFiltered = subjectId !== "";

  // Dependent dropdowns: subjects + exams narrow to the chosen class.
  const classSubjects = useMemo(
    () => (classId ? subjects.filter((s) => s.classId === classId) : subjects),
    [subjects, classId]
  );
  const classExams = useMemo(
    () => (classId ? exams.filter((e) => e.classId === classId) : exams),
    [exams, classId]
  );

  function apply(next: Partial<ReportFilter> = {}) {
    const filter: ReportFilter = {
      classId: (next.classId ?? classId) || undefined,
      examId: (next.examId ?? examId) || undefined,
      subjectId: (next.subjectId ?? subjectId) || undefined,
      from: next.from ?? from,
      to: next.to ?? to,
      status: "published",
    };
    start(async () => {
      try {
        const res = await loadResultsReport(filter);
        setRows(res.rows);
        setCapped(res.capped);
      } catch {
        toast.error("Could not load the report.");
      }
    });
  }

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.studentName} ${r.roll} ${r.examName}`.toLowerCase().includes(needle));
  }, [rows, deferredQ]);

  const columns = useMemo<GridColDef<ResultReportRow>[]>(() => {
    const cols: GridColDef<ResultReportRow>[] = [
      { field: "examName", headerName: "Exam", flex: 1, minWidth: 150 },
      { field: "className", headerName: "Class", width: 110 },
      { field: "roll", headerName: "Roll", width: 72 },
      { field: "studentName", headerName: "Name", flex: 1, minWidth: 140 },
    ];
    if (subjectFiltered) {
      cols.push({ field: "subjectMark", headerName: "Subject", width: 90, type: "number" });
    }
    cols.push(
      { field: "total", headerName: "Total", width: 90, type: "number" },
      { field: "percentage", headerName: "%", width: 80, type: "number" },
      { field: "grade", headerName: "Grade", width: 80 },
      {
        field: "passed",
        headerName: "Result",
        width: 96,
        renderCell: (p: GridRenderCellParams<ResultReportRow>) =>
          p.row.passed ? (
            <Chip size="small" color="success" label="Pass" />
          ) : (
            <Chip size="small" color="error" label="Fail" />
          ),
      }
    );
    return cols;
  }, [subjectFiltered]);

  const renderCard = (r: ResultReportRow) => (
    <DataCard
      title={r.studentName}
      subtitle={`${r.examName} · ${r.className}`}
      right={<Chip size="small" label={r.grade} color={r.passed ? "success" : "error"} variant="outlined" />}
      fields={[
        { label: "Roll", value: r.roll },
        ...(subjectFiltered ? [{ label: "Subject", value: r.subjectMark ?? "—" }] : []),
        { label: "Total", value: `${r.total}/${r.fullTotal}` },
        { label: "%", value: `${r.percentage}` },
      ]}
    />
  );

  function exportExcel() {
    if (filtered.length === 0) return;
    exportToExcel(
      "results-report",
      filtered.map((r) => ({
        Exam: r.examName,
        Date: r.examDate,
        Class: r.className,
        Section: r.sectionName,
        Roll: r.roll,
        Name: r.studentName,
        ...(subjectFiltered ? { Subject: r.subjectMark ?? "" } : {}),
        Total: r.total,
        OutOf: r.fullTotal,
        Percent: r.percentage,
        Grade: r.grade,
        Result: r.passed ? "Pass" : "Fail",
      }))
    );
  }

  function exportPdf() {
    if (filtered.length === 0) return;
    const head = [
      "Exam",
      "Class",
      "Roll",
      "Name",
      ...(subjectFiltered ? ["Subject"] : []),
      "Total",
      "%",
      "Grade",
      "Result",
    ];
    const numericFrom = subjectFiltered ? 5 : 4;
    printReportTable({
      title: centerName,
      subtitle: "Results Report",
      meta: [`${from} — ${to}`],
      head,
      numericFrom,
      rows: filtered.map((r) => [
        r.examName,
        r.className,
        r.roll,
        r.studentName,
        ...(subjectFiltered ? [r.subjectMark ?? ""] : []),
        r.total,
        r.percentage,
        r.grade,
        r.passed ? "Pass" : "Fail",
      ]),
    });
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" } }}>
            <TextField
              select
              label="Class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setExamId("");
                setSubjectId("");
                apply({ classId: e.target.value, examId: "", subjectId: "" });
              }}
            >
              <MenuItem value="">All classes</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Exam"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                apply({ examId: e.target.value });
              }}
            >
              <MenuItem value="">All exams</MenuItem>
              {classExams.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                apply({ subjectId: e.target.value });
              }}
            >
              <MenuItem value="">All subjects</MenuItem>
              {classSubjects.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onBlur={() => apply()}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onBlur={() => apply()}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          {pending && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
        </CardContent>
      </Card>

      {capped && (
        <Alert severity="info">
          Showing the first {rows.length} rows — narrow the filters for a complete export.
        </Alert>
      )}

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search name, roll or exam..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ flex: 1, maxWidth: { md: 420 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" aria-label="clear" onClick={() => setQ("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportExcel} disabled={filtered.length === 0}>
            Excel
          </Button>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={exportPdf} disabled={filtered.length === 0}>
            PDF
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {filtered.length} rows
        </Typography>

        <ResponsiveTable
          rows={filtered}
          columns={columns}
          renderCard={renderCard}
          searchPlaceholder="Search..."
          gridMinWidth={760}
          pageSize={50}
        />
      </Card>
    </Stack>
  );
}
