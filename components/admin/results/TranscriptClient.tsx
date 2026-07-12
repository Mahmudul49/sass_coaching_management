"use client";
import { useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DownloadIcon from "@mui/icons-material/Download";
import DescriptionIcon from "@mui/icons-material/Description";
import PrintIcon from "@mui/icons-material/Print";
import TableChartIcon from "@mui/icons-material/TableChart";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import OrientationToggle, { type Orientation } from "@/components/ui/OrientationToggle";
import { exportToExcel } from "@/lib/excel";
import { printReportTable } from "@/lib/print";
import { printTranscript, printTranscripts, type TranscriptData } from "@/lib/results/transcript";
import type { TranscriptRow } from "@/lib/results/queries";

/**
 * Transcripts screen. The list mirrors a results sheet — a Position column, each
 * subject's marks, total, percentage and overall grade — with Excel/PDF export
 * of the whole list and per-student transcript download (one A4 page → Save as
 * PDF). Nothing is precomputed; transcripts render in the browser on demand.
 */
export default function TranscriptClient({
  centerName,
  title,
  examName,
  grading,
  rows,
}: {
  centerName: string;
  title: string;
  examName: string;
  grading: { range: string; grade: string; point: number }[];
  rows: TranscriptRow[];
}) {
  // Subject columns come from the exam's subject list (identical for every row).
  const subjectNames = useMemo(() => rows[0]?.subjects.map((s) => s.name) ?? [], [rows]);

  // Transcript page orientation (drives the on-demand A4 print document).
  const [orientation, setOrientation] = useState<Orientation>("landscape");

  const toData = (r: TranscriptRow): TranscriptData => ({
    centerName,
    title,
    examName,
    grading,
    studentName: r.name,
    roll: r.roll,
    className: r.className,
    sectionName: r.sectionName,
    subjects: r.subjects,
    grandTotal: r.grandTotal,
    fullTotal: r.fullTotal,
    percentage: r.percentage,
    gpa: r.gpa,
    overallGrade: r.overallGrade,
    passed: r.passed,
    rankClass: r.rankClass,
    classCount: r.classCount,
  });

  const one = (r: TranscriptRow) => printTranscript(toData(r), orientation);
  const all = () => printTranscripts(rows.map(toData), orientation);

  const columns = useMemo<GridColDef<TranscriptRow>[]>(() => {
    const head: GridColDef<TranscriptRow>[] = [
      { field: "rankClass", headerName: "#", width: 56 },
      { field: "roll", headerName: "Roll", width: 72 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
    ];
    const subjectCols: GridColDef<TranscriptRow>[] = subjectNames.map((name, i) => ({
      field: `sub_${i}`,
      headerName: name,
      width: 96,
      type: "number",
      valueGetter: (_v, row) => row.subjects[i]?.obtained ?? null,
    }));
    const tail: GridColDef<TranscriptRow>[] = [
      { field: "grandTotal", headerName: "Total", width: 84, type: "number" },
      { field: "percentage", headerName: "%", width: 78, type: "number" },
      {
        field: "overallGrade",
        headerName: "Grade",
        width: 84,
        renderCell: (p: GridRenderCellParams<TranscriptRow>) => (
          <Chip size="small" label={p.row.overallGrade} color={p.row.passed ? "success" : "error"} variant="outlined" />
        ),
      },
      {
        field: "actions",
        headerName: "Transcript",
        width: 104,
        sortable: false,
        filterable: false,
        renderCell: (p: GridRenderCellParams<TranscriptRow>) => (
          <Tooltip title="Download transcript">
            <IconButton size="small" color="primary" onClick={() => one(p.row)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
    return [...head, ...subjectCols, ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectNames]);

  const renderCard = (r: TranscriptRow) => (
    <DataCard
      title={`#${r.rankClass} · ${r.name}`}
      subtitle={`Roll ${r.roll} · ${r.sectionName}`}
      right={<Chip size="small" label={r.overallGrade} color={r.passed ? "success" : "error"} variant="outlined" />}
      fields={[
        { label: "Total", value: `${r.grandTotal}/${r.fullTotal}` },
        { label: "%", value: `${r.percentage}` },
        { label: "GPA", value: r.gpa.toFixed(2) },
      ]}
      actions={[{ label: "Download transcript", icon: <DownloadIcon fontSize="small" />, onClick: () => one(r) }]}
    />
  );

  function exportExcel() {
    if (rows.length === 0) return;
    exportToExcel(
      "transcripts",
      rows.map((r) => {
        const subjectCols: Record<string, number> = {};
        r.subjects.forEach((s) => (subjectCols[s.name] = s.obtained));
        return {
          Position: r.rankClass,
          Roll: r.roll,
          Name: r.name,
          Section: r.sectionName,
          ...subjectCols,
          Total: r.grandTotal,
          OutOf: r.fullTotal,
          Percent: r.percentage,
          GPA: r.gpa,
          Grade: r.overallGrade,
          Result: r.passed ? "Pass" : "Fail",
        };
      })
    );
  }

  function exportPdf() {
    if (rows.length === 0) return;
    const head = ["#", "Roll", "Name", ...subjectNames, "Total", "%", "Grade", "Result"];
    printReportTable({
      title: centerName,
      subtitle: title,
      meta: [examName],
      head,
      orientation, // shares the toolbar toggle; wide subject grid reads better landscape
      numericFrom: 3, // subjects onward are right-aligned
      rows: rows.map((r) => [
        r.rankClass,
        r.roll,
        r.name,
        ...r.subjects.map((s) => s.obtained),
        r.grandTotal,
        r.percentage,
        r.overallGrade,
        r.passed ? "Pass" : "Fail",
      ]),
    });
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          sx={{ mb: 1.5 }}
        >
          <Typography variant="h6">Students ({rows.length})</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <OrientationToggle value={orientation} onChange={setOrientation} />
            <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={exportExcel} disabled={rows.length === 0}>
              Excel
            </Button>
            <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={exportPdf} disabled={rows.length === 0}>
              Print
            </Button>
            <Button size="small" startIcon={<DescriptionIcon />} onClick={all} disabled={rows.length === 0}>
              Generate all
            </Button>
          </Box>
        </Stack>

        <ResponsiveTable
          rows={rows}
          columns={columns}
          renderCard={renderCard}
          filterText={(r) => `${r.name} ${r.roll}`}
          searchPlaceholder="Search students..."
          gridMinWidth={880}
          pageSize={50}
        />
      </Card>
      <Typography variant="caption" color="text.secondary">
        Each transcript is one A4 page — open in a new tab and use your browser&apos;s Print dialog to save as PDF.
      </Typography>
    </Stack>
  );
}
