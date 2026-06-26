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
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { saveAttendance, resendAttendanceSms } from "@/app/admin/actions/attendance";
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
  const [pending, start] = useTransition();

  const initial = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const s of students) m[s.id] = savedMap[s.id] ?? "present"; // default present
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
            ? `সংরক্ষিত। ${toBnDigits(res.smsSent ?? 0)} টি মেসেজ পাঠানো হয়েছে।`
            : "উপস্থিতি সংরক্ষিত হয়েছে।"
        );
        router.refresh();
      } else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function resend() {
    start(async () => {
      const res = await resendAttendanceSms(classId, date);
      if (res.ok) toast.success(`${toBnDigits(res.smsSent ?? 0)} টি মেসেজ পুনরায় পাঠানো হয়েছে।`);
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  const presentCount = students.filter((s) => statuses[s.id] !== "absent").length;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="ক্লাস"
              value={classId}
              onChange={(e) => navigate({ classId: e.target.value })}
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label="তারিখ"
              value={date}
              onChange={(e) => navigate({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </CardContent>
      </Card>

      {!smsEnabled && (
        <Alert severity="info">
          এই সেন্টারে উপস্থিতির SMS বন্ধ আছে। সেটিংস থেকে চালু করতে পারেন।
        </Alert>
      )}

      {students.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="এই ক্লাসে কোনো ছাত্র নেই"
            description="অন্য ক্লাস নির্বাচন করুন অথবা ছাত্র যোগ করুন।"
          />
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1.5}
              sx={{ mb: 1 }}
            >
              <Chip
                color="success"
                label={`উপস্থিত: ${toBnDigits(presentCount)} / ${toBnDigits(students.length)}`}
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" color="success" onClick={() => setAll("present")}>
                  সবাইকে উপস্থিত
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => setAll("absent")}>
                  সবাইকে অনুপস্থিত
                </Button>
              </Stack>
            </Stack>
            <Divider sx={{ mb: 1 }} />

            <Stack divider={<Divider />}>
              {students.map((s) => (
                <Stack
                  key={s.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ py: 0.5 }}
                >
                  <Box>
                    <Typography variant="body1">{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      রোল: {toBnDigits(s.roll)} · {s.sectionName}
                    </Typography>
                  </Box>
                  <RadioGroup
                    row
                    value={statuses[s.id] ?? "present"}
                    onChange={(e) =>
                      setStatuses((m) => ({ ...m, [s.id]: e.target.value as AttendanceStatus }))
                    }
                  >
                    <FormControlLabel value="present" control={<Radio color="success" />} label="উপস্থিত" />
                    <FormControlLabel value="absent" control={<Radio color="error" />} label="অনুপস্থিত" />
                  </RadioGroup>
                </Stack>
              ))}
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button size="large" onClick={save} disabled={pending}>
                {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </Button>
              {hasSaved && smsEnabled && (
                <Button size="large" variant="outlined" onClick={resend} disabled={pending}>
                  SMS পুনরায় পাঠান
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
