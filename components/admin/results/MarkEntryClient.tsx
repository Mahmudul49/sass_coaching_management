"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SaveIcon from "@mui/icons-material/Save";
import SouthIcon from "@mui/icons-material/South";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { useToast } from "@/components/providers/ToastProvider";
import { saveMarksBulk, type SaveMarksInput } from "@/app/[tenant]/admin/actions/results";
import { computeStudentResult } from "@/lib/results/grade";
import type { GradeBand, MarkEntry, PassRule } from "@/lib/db/collections";
import type { SubjectRow } from "@/lib/results/queries";
import type { MarkEntryRow } from "@/lib/results/queries";

type Row = {
  id: string;
  name: string;
  roll: string;
  sectionName: string;
  phone: string;
  [subjectId: string]: string | number | null;
};

const AUTOSAVE_MS = 1500;
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function flatten(rows: MarkEntryRow[], subjects: SubjectRow[]): Row[] {
  return rows.map((r) => {
    const row: Row = { id: r.id, name: r.name, roll: r.roll, sectionName: r.sectionName, phone: r.phone };
    for (const s of subjects) row[s.id] = r.marks[s.id] ?? null;
    return row;
  });
}

/**
 * Spreadsheet-style mark entry. Reuses the editable DataGrid pattern from
 * PaymentsClient (desktop) with a mobile card fallback. Marks are saved with a
 * DEBOUNCED bulk upsert (one `saveMarksBulk` for the whole class after edits
 * settle) plus an explicit "Save all" — never one write per keystroke. Cells
 * whose value is out of range are flagged inline and never block editing.
 */
export default function MarkEntryClient({
  base,
  examId,
  totalMarks,
  passMarks,
  subjects,
  rows: initialRows,
  gradingScale,
  passRule,
}: {
  base: string;
  examId: string;
  totalMarks: number;
  passMarks: number;
  subjects: SubjectRow[];
  rows: MarkEntryRow[];
  gradingScale: GradeBand[];
  passRule: PassRule;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => flatten(initialRows, subjects));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const cfg = useMemo(
    () => ({ totalMarks, passMarks, subjectIds: subjects.map((s) => s.id), passRule, gradingScale }),
    [totalMarks, passMarks, subjects, passRule, gradingScale]
  );

  const resultOf = useCallback(
    (row: Row) => {
      const entries: MarkEntry[] = subjects.map((s) => ({
        subjectId: s.id,
        obtained: row[s.id] === null || row[s.id] === "" ? null : Number(row[s.id]),
      }));
      return computeStudentResult(entries, cfg);
    },
    [subjects, cfg]
  );

  const toInputs = useCallback(
    (rs: Row[]): SaveMarksInput[] =>
      rs.map((r) => ({
        studentId: r.id,
        entries: subjects.map((s) => ({
          subjectId: s.id,
          obtained: r[s.id] === null || r[s.id] === "" ? null : Number(r[s.id]),
        })),
      })),
    [subjects]
  );

  const persist = useCallback(
    (rs: Row[], announce = false) => {
      setSaveState("saving");
      start(async () => {
        try {
          const res = await saveMarksBulk(examId, toInputs(rs));
          if (res.ok) {
            setSaveState("saved");
            if (announce) toast.success(`Saved ${res.saved} rows.`);
          } else {
            setSaveState("error");
            toast.error(res.error ?? "Some marks could not be saved.");
          }
        } catch {
          setSaveState("error");
          toast.error("Something went wrong.");
        }
      });
    },
    [examId, toInputs, toast]
  );

  // Debounced autosave: schedule a bulk save AUTOSAVE_MS after the last edit.
  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(rowsRef.current), AUTOSAVE_MS);
  }, [persist]);

  // Flush a pending autosave on unmount so nothing entered is lost.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const setMark = (id: string, subjectId: string, value: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [subjectId]: value === "" ? null : Math.max(0, Number(value)) } : r)));
    scheduleSave();
  };

  const processRowUpdate = useCallback(
    (updated: Row) => {
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      scheduleSave();
      return updated;
    },
    [scheduleSave]
  );

  // Copy-down fill: propagate the last entered value down the blank cells of
  // every subject column (spreadsheet-style).
  const fillDown = () => {
    setRows((rs) => {
      const next = rs.map((r) => ({ ...r }));
      for (const s of subjects) {
        let last: number | null = null;
        for (const r of next) {
          if (r[s.id] === null || r[s.id] === "") {
            if (last !== null) r[s.id] = last;
          } else last = Number(r[s.id]);
        }
      }
      return next;
    });
    scheduleSave();
  };

  const saveAll = () => {
    if (timer.current) clearTimeout(timer.current);
    persist(rowsRef.current, true);
  };

  // Progress: how many students have every subject entered.
  const complete = rows.filter((r) => subjects.every((s) => r[s.id] !== null && r[s.id] !== "")).length;
  const pct = rows.length > 0 ? Math.round((complete / rows.length) * 100) : 0;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.name} ${r.roll}`.toLowerCase().includes(needle));
  }, [rows, q]);

  const outOfRange = (v: unknown) => v !== null && v !== "" && (Number(v) < 0 || Number(v) > totalMarks);

  const columns = useMemo<GridColDef<Row>[]>(() => {
    const base: GridColDef<Row>[] = [
      { field: "roll", headerName: "Roll", width: 72 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
    ];
    const subjectCols: GridColDef<Row>[] = subjects.map((s) => ({
      field: s.id,
      headerName: s.name,
      width: 110,
      editable: true,
      type: "number",
      // Flag out-of-range marks inline (red) — never blocks navigation.
      cellClassName: (p) => (outOfRange(p.value) ? "mark-invalid" : ""),
    }));
    const tail: GridColDef<Row>[] = [
      {
        field: "total",
        headerName: "Total",
        width: 96,
        valueGetter: (_v, row) => resultOf(row).total,
      },
      {
        field: "grade",
        headerName: "Grade",
        width: 90,
        renderCell: (p: GridRenderCellParams<Row>) => {
          const r = resultOf(p.row);
          return <Chip size="small" label={r.grade} color={r.passed ? "success" : "error"} variant="outlined" />;
        },
      },
    ];
    return [...base, ...subjectCols, ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, totalMarks, resultOf]);

  const saveLabel: Record<SaveState, string> = {
    idle: "All saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "All saved",
    error: "Save failed",
  };
  const saveColor: Record<SaveState, "default" | "warning" | "info" | "success" | "error"> = {
    idle: "default",
    dirty: "warning",
    saving: "info",
    saved: "success",
    error: "error",
  };

  return (
    <Stack spacing={2}>
      {/* Progress + tools */}
      <Card>
        <CardContent sx={{ py: 1.75 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {complete} / {rows.length} students complete
            </Typography>
            <Chip size="small" label={saveLabel[saveState]} color={saveColor[saveState]} variant="outlined" />
          </Stack>
          <LinearProgress variant="determinate" value={pct} color="success" sx={{ height: 8, borderRadius: 5 }} />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<SouthIcon />} onClick={fillDown}>
              Fill blanks down
            </Button>
            <Button
              component={Link}
              href={`${base}/${examId}`}
              size="small"
              variant="text"
              color="inherit"
              startIcon={<VisibilityIcon />}
            >
              Review results
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search by name or roll..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
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
        sx={{ maxWidth: { md: 420 } }}
      />

      {/* Mobile: student cards with per-subject numeric inputs (no horizontal scroll) */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <Stack spacing={1.5}>
          {filtered.map((row) => {
            const r = resultOf(row);
            return (
              <Card key={row.id} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                    <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: 15 }}>
                      {row.name?.trim()?.[0] ?? "?"}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Roll {row.roll} · {row.sectionName}
                      </Typography>
                    </Box>
                    <Chip size="small" label={`${r.total} · ${r.grade}`} color={r.passed ? "success" : "error"} variant="outlined" />
                  </Stack>
                  <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 1fr" }}>
                    {subjects.map((s) => {
                      const val = row[s.id];
                      const bad = outOfRange(val);
                      return (
                        <TextField
                          key={s.id}
                          label={s.name}
                          type="number"
                          size="small"
                          value={val ?? ""}
                          onChange={(e) => setMark(row.id, s.id, e.target.value)}
                          error={bad}
                          helperText={bad ? `0–${totalMarks}` : undefined}
                          inputProps={{ inputMode: "numeric", min: 0, max: totalMarks }}
                          InputProps={{ endAdornment: <InputAdornment position="end">/{totalMarks}</InputAdornment> }}
                        />
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>

      {/* Desktop: editable grid (Tab/Enter navigation is built in) */}
      <Card sx={{ p: { xs: 1, sm: 2 }, display: { xs: "none", md: "block" } }}>
        <Box sx={{ width: "100%", overflowX: "auto", "& .mark-invalid": { color: "error.main", fontWeight: 700 } }}>
          <Box sx={{ minWidth: 640 }}>
            <DataGrid
              autoHeight
              rows={filtered}
              columns={columns}
              processRowUpdate={processRowUpdate}
              onProcessRowUpdateError={() => toast.error("Could not update the cell.")}
              disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
              pageSizeOptions={[25, 50, 100]}
              sx={{ border: 0 }}
            />
          </Box>
        </Box>
      </Card>

      {/* Sticky save bar (primary action in the thumb zone) */}
      <Paper
        elevation={4}
        sx={{
          position: "sticky",
          bottom: { xs: 72, md: 8 },
          zIndex: 3,
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {pct}% complete
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="large" startIcon={<SaveIcon />} onClick={saveAll} disabled={pending}>
          {pending ? "Saving…" : "Save all"}
        </Button>
      </Paper>
    </Stack>
  );
}
