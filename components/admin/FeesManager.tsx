"use client";
import { useEffect, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { saveFeeStructure } from "@/app/[tenant]/admin/actions/master";
import type { FeeRow } from "@/lib/admin/queries";
import { BN_MONTHS, monthName, taka } from "@/lib/format";

function MonthField({
  value,
  onChange,
  label = "মাস",
}: {
  value: number;
  onChange: (m: number) => void;
  label?: string;
}) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      sx={{ minWidth: 130 }}
    >
      {BN_MONTHS.map((m, i) => (
        <MenuItem key={i} value={i + 1}>
          {m}
        </MenuItem>
      ))}
    </TextField>
  );
}

export default function FeesManager({ fees }: { fees: FeeRow[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<FeeRow | null>(null);
  const [pending, start] = useTransition();

  const [form, setForm] = useState({
    admissionFee: "0",
    admissionMonth: 1,
    monthlyFee: "0",
    halfAmount: "0",
    halfMonth: 6,
    halfEnabled: true,
    annualAmount: "0",
    annualMonth: 12,
    annualEnabled: true,
    others: [] as { label: string; amount: string; month: number }[],
  });

  useEffect(() => {
    if (editing) {
      setForm({
        admissionFee: String(editing.admissionFee),
        admissionMonth: editing.admissionMonth || 1,
        monthlyFee: String(editing.monthlyFee),
        halfAmount: String(editing.modelTestHalfYearly.amount),
        halfMonth: editing.modelTestHalfYearly.month,
        halfEnabled: editing.modelTestHalfYearly.enabled !== false,
        annualAmount: String(editing.modelTestAnnual.amount),
        annualMonth: editing.modelTestAnnual.month,
        annualEnabled: editing.modelTestAnnual.enabled !== false,
        others: editing.others.map((o) => ({
          label: o.label,
          amount: String(o.amount),
          month: o.month || 1,
        })),
      });
    }
  }, [editing]);

  function save() {
    if (!editing) return;
    start(async () => {
      const res = await saveFeeStructure({
        classId: editing.classId,
        admissionFee: Number(form.admissionFee) || 0,
        admissionMonth: form.admissionMonth,
        monthlyFee: Number(form.monthlyFee) || 0,
        modelTestHalfYearly: {
          amount: Number(form.halfAmount) || 0,
          month: form.halfMonth,
          enabled: form.halfEnabled,
        },
        modelTestAnnual: {
          amount: Number(form.annualAmount) || 0,
          month: form.annualMonth,
          enabled: form.annualEnabled,
        },
        others: form.others.map((o) => ({
          label: o.label,
          amount: Number(o.amount) || 0,
          month: o.month,
        })),
      });
      if (res.ok) {
        toast.success("ফি স্ট্রাকচার সংরক্ষিত হয়েছে।");
        setEditing(null);
      } else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  if (fees.length === 0) {
    return (
      <Card sx={{ p: 2 }}>
        <EmptyState
          title="আগে ক্লাস তৈরি করুন"
          description="ফি স্ট্রাকচার সেট করার আগে ক্লাস থাকতে হবে।"
        />
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {fees.map((f) => (
        <Card key={f.classId}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">{f.className}</Typography>
              <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(f)}>
                সম্পাদনা
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {f.admissionFee > 0 && (
                <Chip label={`ভর্তি: ${taka(f.admissionFee)} (${monthName(f.admissionMonth)})`} />
              )}
              <Chip label={`মাসিক: ${taka(f.monthlyFee)}`} color="primary" />
              {f.modelTestHalfYearly.enabled && f.modelTestHalfYearly.amount > 0 && (
                <Chip
                  label={`ষান্মাসিক মডেল টেস্ট: ${taka(f.modelTestHalfYearly.amount)} (${monthName(
                    f.modelTestHalfYearly.month
                  )})`}
                />
              )}
              {f.modelTestAnnual.enabled && f.modelTestAnnual.amount > 0 && (
                <Chip
                  label={`বার্ষিক মডেল টেস্ট: ${taka(f.modelTestAnnual.amount)} (${monthName(
                    f.modelTestAnnual.month
                  )})`}
                />
              )}
              {f.others.map((o, i) => (
                <Chip key={i} label={`${o.label}: ${taka(o.amount)} (${monthName(o.month)})`} variant="outlined" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={!!editing}
        onClose={pending ? undefined : () => setEditing(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>ফি স্ট্রাকচার — {editing?.className}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Divider>ভর্তি ফি</Divider>
            <Stack direction="row" spacing={2}>
              <TextField
                label="টাকা"
                type="number"
                value={form.admissionFee}
                onChange={(e) => setForm((f) => ({ ...f, admissionFee: e.target.value }))}
              />
              <MonthField value={form.admissionMonth} onChange={(m) => setForm((f) => ({ ...f, admissionMonth: m }))} />
            </Stack>

            <TextField
              label="মাসিক ফি"
              type="number"
              value={form.monthlyFee}
              onChange={(e) => setForm((f) => ({ ...f, monthlyFee: e.target.value }))}
            />

            <Divider>ষান্মাসিক মডেল টেস্ট</Divider>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.halfEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, halfEnabled: e.target.checked }))}
                />
              }
              label="চালু"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="টাকা"
                type="number"
                value={form.halfAmount}
                disabled={!form.halfEnabled}
                onChange={(e) => setForm((f) => ({ ...f, halfAmount: e.target.value }))}
              />
              <MonthField value={form.halfMonth} onChange={(m) => setForm((f) => ({ ...f, halfMonth: m }))} />
            </Stack>

            <Divider>বার্ষিক মডেল টেস্ট</Divider>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.annualEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, annualEnabled: e.target.checked }))}
                />
              }
              label="চালু"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="টাকা"
                type="number"
                value={form.annualAmount}
                disabled={!form.annualEnabled}
                onChange={(e) => setForm((f) => ({ ...f, annualAmount: e.target.value }))}
              />
              <MonthField value={form.annualMonth} onChange={(m) => setForm((f) => ({ ...f, annualMonth: m }))} />
            </Stack>

            <Divider>অন্যান্য ফি</Divider>
            {form.others.map((o, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                  label="নাম"
                  value={o.label}
                  onChange={(e) =>
                    setForm((f) => {
                      const others = [...f.others];
                      others[i] = { ...others[i], label: e.target.value };
                      return { ...f, others };
                    })
                  }
                  sx={{ minWidth: 120, flex: 1 }}
                />
                <TextField
                  label="টাকা"
                  type="number"
                  value={o.amount}
                  onChange={(e) =>
                    setForm((f) => {
                      const others = [...f.others];
                      others[i] = { ...others[i], amount: e.target.value };
                      return { ...f, others };
                    })
                  }
                  sx={{ maxWidth: 120 }}
                />
                <MonthField
                  value={o.month}
                  onChange={(m) =>
                    setForm((f) => {
                      const others = [...f.others];
                      others[i] = { ...others[i], month: m };
                      return { ...f, others };
                    })
                  }
                />
                <IconButton
                  color="error"
                  onClick={() => setForm((f) => ({ ...f, others: f.others.filter((_, j) => j !== i) }))}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            ))}
            <Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                variant="text"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    others: [...f.others, { label: "", amount: "0", month: 1 }],
                  }))
                }
              >
                আরও ফি যোগ করুন
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="text" color="inherit" onClick={() => setEditing(null)} disabled={pending}>
            বাতিল
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
