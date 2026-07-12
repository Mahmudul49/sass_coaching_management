"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import EditIcon from "@mui/icons-material/Edit";
import PublishIcon from "@mui/icons-material/Publish";
import DescriptionIcon from "@mui/icons-material/Description";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { publishExam } from "@/app/[tenant]/admin/actions/results";
import type { ExamRow, ResultRow, SubjectRow } from "@/lib/results/queries";

type FlatRow = {
  id: string;
  position: number;
  name: string;
  roll: string;
  sectionName: string;
  total: number;
  fullTotal: number;
  percentage: number;
  grade: string;
  passed: boolean;
  marks: Record<string, number | null>;
};

/**
 * Results review + publish. Auto-computed totals/%/grade/pass-fail (from the
 * server compute), responsive table/cards, and the one irreversible action —
 * Publish — behind an explicit confirm. Edit link goes back to Mark Entry.
 */
export default function ResultsClient({
  base,
  exam,
  subjects,
  rows,
}: {
  base: string;
  exam: ExamRow;
  subjects: SubjectRow[];
  rows: ResultRow[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const published = exam.status === "published";

  const flat = useMemo<FlatRow[]>(
    () =>
      rows.map((r, i) => {
        const marks: Record<string, number | null> = {};
        for (const s of r.result.subjects) marks[s.subjectId] = s.obtained;
        return {
          id: r.id,
          position: i + 1,
          name: r.name,
          roll: r.roll,
          sectionName: r.sectionName,
          total: r.result.total,
          fullTotal: r.result.fullTotal,
          percentage: r.result.percentage,
          grade: r.result.grade,
          passed: r.result.passed,
          marks,
        };
      }),
    [rows]
  );

  const summary = useMemo(() => {
    const passed = rows.filter((r) => r.result.passed).length;
    const withMarks = rows.filter((r) => r.result.entered > 0);
    const avg =
      withMarks.length > 0
        ? Math.round((withMarks.reduce((a, r) => a + r.result.percentage, 0) / withMarks.length) * 10) / 10
        : 0;
    const incomplete = rows.filter((r) => !r.result.complete).length;
    return { passed, failed: rows.length - passed, avg, incomplete };
  }, [rows]);

  function doPublish() {
    start(async () => {
      const res = await publishExam(exam.id);
      if (res.ok) {
        toast.success(res.notified ? `Published — ${res.notified} SMS sent.` : "Results published.");
        setConfirm(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
        setConfirm(false);
      }
    });
  }

  const columns = useMemo<GridColDef<FlatRow>[]>(() => {
    const head: GridColDef<FlatRow>[] = [
      { field: "position", headerName: "#", width: 56 },
      { field: "roll", headerName: "Roll", width: 72 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
    ];
    const subjectCols: GridColDef<FlatRow>[] = subjects.map((s) => ({
      field: `sub_${s.id}`,
      headerName: s.name,
      width: 100,
      type: "number",
      valueGetter: (_v, row) => row.marks[s.id],
    }));
    const tail: GridColDef<FlatRow>[] = [
      { field: "total", headerName: "Total", width: 90 },
      { field: "percentage", headerName: "%", width: 80 },
      {
        field: "grade",
        headerName: "Grade",
        width: 90,
        renderCell: (p: GridRenderCellParams<FlatRow>) => (
          <Chip size="small" label={p.row.grade} color={p.row.passed ? "success" : "error"} variant="outlined" />
        ),
      },
      {
        field: "result",
        headerName: "Result",
        width: 100,
        renderCell: (p: GridRenderCellParams<FlatRow>) =>
          p.row.passed ? (
            <Chip size="small" color="success" label="Pass" />
          ) : (
            <Chip size="small" color="error" label="Fail" />
          ),
      },
    ];
    return [...head, ...subjectCols, ...tail];
  }, [subjects]);

  const renderCard = (r: FlatRow) => (
    <DataCard
      title={`#${r.position} · ${r.name}`}
      subtitle={`Roll ${r.roll} · ${r.sectionName}`}
      right={<Chip size="small" label={r.grade} color={r.passed ? "success" : "error"} variant="outlined" />}
      fields={[
        { label: "Total", value: `${r.total}/${r.fullTotal}` },
        { label: "Percent", value: `${r.percentage}%` },
        { label: "Result", value: r.passed ? "Pass" : "Fail" },
      ]}
    />
  );

  return (
    <Stack spacing={2}>
      {published && (
        <Alert severity="success" icon={<PublishIcon />}>
          Published{exam.publishedAt ? ` on ${new Date(exam.publishedAt).toLocaleDateString()}` : ""}. Marks are
          locked.
        </Alert>
      )}

      {/* Summary tiles */}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
        <StatCard label="Passed" value={String(summary.passed)} color="success.main" />
        <StatCard label="Failed" value={String(summary.failed)} color="error.main" />
        <StatCard label="Class average" value={`${summary.avg}%`} color="#0284C7" />
        <StatCard label="Incomplete" value={String(summary.incomplete)} color="#D97706" />
      </Box>

      {summary.incomplete > 0 && !published && (
        <Alert severity="warning">
          {summary.incomplete} student(s) don&apos;t have every subject entered. You can still publish, but blanks
          count as 0.
        </Alert>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {!published && (
          <Button component={Link} href={`${base}/${exam.id}/marks`} variant="outlined" color="inherit" startIcon={<EditIcon />}>
            Edit marks
          </Button>
        )}
        {published ? (
          <Button component={Link} href={`${base}/${exam.id}/transcript`} startIcon={<DescriptionIcon />}>
            Transcripts
          </Button>
        ) : (
          <Button color="success" startIcon={<PublishIcon />} onClick={() => setConfirm(true)} disabled={pending}>
            Publish results
          </Button>
        )}
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <ResponsiveTable
          rows={flat}
          columns={columns}
          renderCard={renderCard}
          filterText={(r) => `${r.name} ${r.roll}`}
          searchPlaceholder="Search students..."
          gridMinWidth={720}
        />
      </Card>

      <ConfirmDialog
        open={confirm}
        title="Publish results?"
        message="Publishing is final: marks are locked and guardians are notified by SMS (if enabled in Settings). Continue?"
        confirmText="Publish"
        cancelText="Cancel"
        loading={pending}
        onConfirm={doPublish}
        onClose={() => setConfirm(false)}
      />

      <Typography variant="caption" color="text.secondary">
        Pass mark: {exam.passMarks}/{exam.totalMarks} per subject.
      </Typography>
    </Stack>
  );
}
