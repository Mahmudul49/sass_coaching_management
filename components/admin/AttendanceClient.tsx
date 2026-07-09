"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { saveAttendance, resendAttendanceSms } from "@/app/[tenant]/admin/actions/attendance";
import type { ClassRow, StudentRow } from "@/lib/admin/queries";
import type { AttendanceStatus } from "@/lib/db/collections";
import { toBnDigits } from "@/lib/format";

export default function AttendanceClient({
  classes,
  classId,
  date,
  students,
  savedMap,
  smsEnabled,
}: {
  classes: ClassRow[];
  classId: string;
  date: string;
  students: StudentRow[];
  savedMap: Record<string, AttendanceStatus>;
  smsEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();

  const initial = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const s of students) m[s.id] = savedMap[s.id] ?? "present";
    return m;
  }, [students, savedMap]);

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(initial);
  useEffect(() => setStatuses(initial), [initial]);

  const hasSaved = Object.keys(savedMap).length > 0;

  function navigate(next: { classId?: string; date?: string }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? classId);
    params.set("date", next.date ?? date);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setAll(status: AttendanceStatus) {
    const m: Record<string, AttendanceStatus> = {};
    for (const s of students) m[s.id] = status;
    setStatuses(m);
  }

  function save() {
    start(async () => {
      const res = await saveAttendance({
        classId,
        date,
        statuses: students.map((s) => ({ studentId: s.id, status: statuses[s.id] ?? "present" })),
      });
      if (res.ok) {
        toast.success(
          smsEnabled
            ? `${t("att_saved_sms")} ${toBnDigits(res.smsSent ?? 0)} ${t("att_msgs_sent")}`
            : t("att_saved")
        );
        router.refresh();
      } else toast.error(res.error ?? t("c_something_wrong"));
    });
  }

  function resend() {
    start(async () => {
      const res = await resendAttendanceSms(classId, date);
      if (res.ok) toast.success(`${toBnDigits(res.smsSent ?? 0)} ${t("att_msgs_resent")}`);
      else toast.error(res.error ?? t("c_something_wrong"));
    });
  }

  const presentCount = students.filter((s) => statuses[s.id] !== "absent").length;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("c_class")} value={classId} onChange={(e) => navigate({ classId: e.target.value })}>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label={t("att_date")}
              value={date}
              onChange={(e) => navigate({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </CardContent>
      </Card>

      {!smsEnabled && <Alert severity="info">{t("att_sms_off")}</Alert>}

      {students.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            title={t("att_no_students")}
            description={t("att_no_students_desc")}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Button fullWidth variant="outlined" color="success" onClick={() => setAll("present")}>
                  {t("att_all_present")}
                </Button>
                <Button fullWidth variant="outlined" color="error" onClick={() => setAll("absent")}>
                  {t("att_all_absent")}
                </Button>
              </Stack>
              <Divider />

              <Stack divider={<Divider />}>
                {students.map((s) => (
                  <Stack
                    key={s.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ py: 1.25 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("c_roll")} {toBnDigits(s.roll)} · {s.sectionName}
                      </Typography>
                    </Box>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={statuses[s.id] ?? "present"}
                      onChange={(_e, v) => {
                        if (v) setStatuses((m) => ({ ...m, [s.id]: v as AttendanceStatus }));
                      }}
                      sx={{ flexShrink: 0 }}
                    >
                      <ToggleButton
                        value="present"
                        color="success"
                        sx={{ px: 1.5, "&.Mui-selected": { bgcolor: "success.main", color: "#fff", "&:hover": { bgcolor: "success.dark" } } }}
                      >
                        {t("att_present")}
                      </ToggleButton>
                      <ToggleButton
                        value="absent"
                        color="error"
                        sx={{ px: 1.5, "&.Mui-selected": { bgcolor: "error.main", color: "#fff", "&:hover": { bgcolor: "error.dark" } } }}
                      >
                        {t("att_absent")}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Sticky save bar — always reachable above the mobile bottom nav */}
          <Paper
            elevation={4}
            sx={{
              position: "sticky",
              bottom: { xs: 72, md: 8 },
              zIndex: 3,
              p: 1.5,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Chip
              color="success"
              label={`${t("att_present")} ${toBnDigits(presentCount)}/${toBnDigits(students.length)}`}
              sx={{ fontWeight: 700 }}
            />
            <Box sx={{ flex: 1 }} />
            {hasSaved && smsEnabled && (
              <Button variant="outlined" onClick={resend} disabled={pending}>
                SMS
              </Button>
            )}
            <Button onClick={save} disabled={pending} sx={{ minWidth: 140 }}>
              {pending ? t("att_saving") : t("att_save")}
            </Button>
          </Paper>
        </>
      )}
    </Stack>
  );
}
