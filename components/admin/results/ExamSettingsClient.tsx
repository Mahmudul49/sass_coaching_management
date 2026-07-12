"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import { useToast } from "@/components/providers/ToastProvider";
import { saveExamSettings } from "@/app/[tenant]/admin/actions/results";
import type { GradeBand, PassRule } from "@/lib/db/collections";
import type { ExamSettings } from "@/lib/results/settings";

/**
 * Results settings: grading scale, pass rule, default marks, exam-type presets,
 * certificate title and the notify-on-publish toggle. Saved as the single tenant
 * settings doc and reused as defaults across Exam Setup, Results & Certificates.
 * Sectioned-card layout mirrors the existing SettingsClient.
 */
export default function ExamSettingsClient({ settings }: { settings: ExamSettings }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [scale, setScale] = useState<GradeBand[]>(settings.gradingScale);
  const [passRule, setPassRule] = useState<PassRule>(settings.passRule);
  const [defTotal, setDefTotal] = useState(settings.defaultTotalMarks);
  const [defPass, setDefPass] = useState(settings.defaultPassMarks);
  const [types, setTypes] = useState<string[]>(settings.examTypes);
  const [newType, setNewType] = useState("");
  const [certTitle, setCertTitle] = useState(settings.certificateTitle);
  const [notify, setNotify] = useState(settings.notifyOnPublish);

  const setBand = (i: number, patch: Partial<GradeBand>) =>
    setScale((s) => s.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBand = () => setScale((s) => [...s, { grade: "", minPct: 0, point: 0 }]);
  const removeBand = (i: number) => setScale((s) => s.filter((_, idx) => idx !== i));

  const addType = () => {
    const t = newType.trim();
    if (t && !types.includes(t)) setTypes((prev) => [...prev, t]);
    setNewType("");
  };
  const removeType = (t: string) => setTypes((prev) => prev.filter((x) => x !== t));

  function save() {
    start(async () => {
      const res = await saveExamSettings({
        gradingScale: scale,
        passRule,
        defaultTotalMarks: defTotal,
        defaultPassMarks: defPass,
        examTypes: types,
        certificateTitle: certTitle,
        notifyOnPublish: notify,
      });
      if (res.ok) {
        toast.success("Settings saved.");
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong.");
    });
  }

  return (
    <Stack spacing={2}>
      {/* Grading scale */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Grading scale
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Highest band first. A percentage earns the first band it reaches; the lowest band is the fail grade.
          </Typography>
          <Stack spacing={1} divider={<Divider flexItem />}>
            {scale.map((b, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Grade"
                  value={b.grade}
                  onChange={(e) => setBand(i, { grade: e.target.value })}
                  sx={{ width: 100 }}
                  size="small"
                />
                <TextField
                  label="Min %"
                  type="number"
                  value={b.minPct}
                  onChange={(e) => setBand(i, { minPct: Number(e.target.value) || 0 })}
                  inputProps={{ inputMode: "numeric", min: 0, max: 100 }}
                  size="small"
                />
                <TextField
                  label="GPA"
                  type="number"
                  value={b.point}
                  onChange={(e) => setBand(i, { point: Number(e.target.value) || 0 })}
                  inputProps={{ inputMode: "decimal", min: 0 }}
                  size="small"
                />
                <IconButton color="error" onClick={() => removeBand(i)} aria-label="remove band">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Button size="small" startIcon={<AddIcon />} onClick={addBand} sx={{ mt: 1.5 }}>
            Add band
          </Button>
        </CardContent>
      </Card>

      {/* Pass rule + defaults */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pass criteria & defaults
          </Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField select label="Pass rule" value={passRule} onChange={(e) => setPassRule(e.target.value as PassRule)}>
              <MenuItem value="per_subject">Must pass every subject</MenuItem>
              <MenuItem value="overall">Pass on overall percentage</MenuItem>
            </TextField>
            <Box />
            <TextField
              label="Default total marks"
              type="number"
              value={defTotal}
              onChange={(e) => setDefTotal(Math.max(1, Number(e.target.value) || 0))}
              inputProps={{ inputMode: "numeric", min: 1 }}
            />
            <TextField
              label="Default pass marks"
              type="number"
              value={defPass}
              onChange={(e) => setDefPass(Math.max(0, Number(e.target.value) || 0))}
              inputProps={{ inputMode: "numeric", min: 0 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Exam type presets */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Exam types
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
            {types.map((t) => (
              <Chip key={t} label={t} onDelete={() => removeType(t)} />
            ))}
            {types.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No presets yet.
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Add a type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addType();
                }
              }}
            />
            <Button variant="outlined" onClick={addType}>
              Add
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Certificate + notifications */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transcript & notifications
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Transcript title"
              helperText='Shown on the transcript, prefixed by the exam type (e.g. "Half Yearly Academic Transcript - 2026")'
              value={certTitle}
              onChange={(e) => setCertTitle(e.target.value)}
            />
            <FormControlLabel
              control={<Switch checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
              label="Send guardians an SMS when results are published"
            />
            <Typography variant="body2" color="text.secondary">
              With many students, publish-time SMS uses your gateway balance. It is sent in one batch, not per
              student.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="large" startIcon={<SaveIcon />} onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </Box>
    </Stack>
  );
}
