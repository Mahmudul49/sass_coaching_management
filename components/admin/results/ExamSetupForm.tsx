"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import SaveIcon from "@mui/icons-material/Save";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { createExam } from "@/app/[tenant]/admin/actions/results";
import { todayISO } from "@/lib/format";
import type { ClassRow } from "@/lib/admin/queries";
import type { SubjectRow } from "@/lib/results/queries";

/**
 * Exam Setup — ~3-click happy path. Class/type/marks default from Settings;
 * subjects are the selected class's subjects (all checked by default). Save
 * creates the exam and redirects straight to Mark Entry.
 */
export default function ExamSetupForm({
  base,
  classes,
  subjects,
  examTypes,
  defaultTotalMarks,
  defaultPassMarks,
}: {
  base: string;
  classes: ClassRow[];
  subjects: SubjectRow[];
  examTypes: string[];
  defaultTotalMarks: number;
  defaultPassMarks: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [examType, setExamType] = useState(examTypes[0] ?? "Exam");
  const [date, setDate] = useState(todayISO());
  const [totalMarks, setTotalMarks] = useState(defaultTotalMarks);
  const [passMarks, setPassMarks] = useState(defaultPassMarks);

  // Subjects for the chosen class; selection is a set of subjectIds.
  const classSubjects = useMemo(
    () => subjects.filter((s) => s.classId === classId),
    [subjects, classId]
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(subjects.filter((s) => s.classId === (classes[0]?.id ?? "")).map((s) => s.id))
  );

  function changeClass(id: string) {
    setClassId(id);
    // Default to all subjects of the newly chosen class selected.
    setSelected(new Set(subjects.filter((s) => s.classId === id).map((s) => s.id)));
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function submit() {
    setError(null);
    const subjectIds = classSubjects.filter((s) => selected.has(s.id)).map((s) => s.id);
    start(async () => {
      const res = await createExam({
        classId,
        name,
        examType,
        date,
        totalMarks,
        passMarks,
        subjectIds,
      });
      if (res.ok && res.examId) {
        toast.success("Exam created — enter marks.");
        router.push(`${base}/${res.examId}/marks`);
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField select label="Class" value={classId} onChange={(e) => changeClass(e.target.value)}>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Exam name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. First Term Test"
              autoFocus
            />
            <TextField select label="Exam type" value={examType} onChange={(e) => setExamType(e.target.value)}>
              {examTypes.map((tpe) => (
                <MenuItem key={tpe} value={tpe}>
                  {tpe}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Total marks (per subject)"
              type="number"
              value={totalMarks}
              onChange={(e) => setTotalMarks(Math.max(1, Number(e.target.value) || 0))}
              inputProps={{ inputMode: "numeric", min: 1 }}
            />
            <TextField
              label="Pass marks (per subject)"
              type="number"
              value={passMarks}
              onChange={(e) => setPassMarks(Math.max(0, Number(e.target.value) || 0))}
              inputProps={{ inputMode: "numeric", min: 0 }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Subjects{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                ({selected.size} selected)
              </Typography>
            </Typography>
            {classSubjects.length === 0 ? (
              <EmptyState
                title="No subjects in this class"
                description="Add subjects to this class first."
              />
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {classSubjects.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <Chip
                      key={s.id}
                      label={s.name}
                      color={on ? "primary" : "default"}
                      variant={on ? "filled" : "outlined"}
                      onClick={() => toggle(s.id)}
                      sx={{ cursor: "pointer" }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="large"
              startIcon={<SaveIcon />}
              onClick={submit}
              disabled={pending || !name.trim() || selected.size === 0}
            >
              {pending ? "Creating…" : "Create & enter marks"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
