"use client";
import { useState } from "react";
import NextLink from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CloseIcon from "@mui/icons-material/Close";
import { toBnDigits } from "@/lib/format";
import type { SetupStatus } from "@/lib/admin/queries";

const STORAGE_KEY = "setup-checklist-dismissed";

export default function SetupChecklist({ status }: { status: SetupStatus }) {
  const [dismissed, setDismissed] = useState(false);

  const steps = [
    { label: "ক্লাস যোগ করুন", done: status.hasClasses },
    { label: "শাখা যোগ করুন", done: status.hasSections },
    { label: "ফি স্ট্রাকচার সেট করুন", done: status.hasFees },
    { label: "ছাত্র যোগ করুন", done: status.hasStudents },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = (doneCount / steps.length) * 100;

  // Once complete, the checklist is dismissible and stays hidden.
  const initiallyDismissed =
    typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
  if ((status.complete && initiallyDismissed) || dismissed) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card sx={{ borderLeft: "5px solid", borderColor: "primary.main" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">প্রাথমিক সেটআপ</Typography>
          {status.complete && (
            <IconButton size="small" onClick={dismiss} aria-label="বন্ধ করুন">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {toBnDigits(doneCount)}/{toBnDigits(steps.length)} ধাপ সম্পন্ন
        </Typography>
        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, mb: 2 }} />

        <Stack spacing={1}>
          {steps.map((s) => (
            <Stack key={s.label} direction="row" spacing={1} alignItems="center">
              {s.done ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : (
                <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
              )}
              <Typography
                variant="body2"
                sx={{ textDecoration: s.done ? "line-through" : "none", color: s.done ? "text.disabled" : "text.primary" }}
              >
                {s.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        {!status.complete && (
          <Box sx={{ mt: 2 }}>
            <Button component={NextLink} href="/admin/setup">
              সেটআপ চালিয়ে যান
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
