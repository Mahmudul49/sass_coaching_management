import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, listStudents, getAttendanceMap } from "@/lib/admin/queries";
import EmptyState from "@/components/ui/EmptyState";
import AttendanceClient from "@/components/admin/AttendanceClient";
import { todayISO } from "@/lib/format";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const { tenant: slug } = await params;
  const { db, tenant } = await requireAdmin(slug);
  const classes = await listClasses(db);

  if (classes.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">উপস্থিতি</Typography>
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="আগে ক্লাস ও ছাত্র যোগ করুন"
            description="উপস্থিতি নেওয়ার আগে ক্লাস ও ছাত্র থাকতে হবে।"
          />
        </Card>
      </Stack>
    );
  }

  const sp = await searchParams;
  const classId = sp.classId || classes[0].id;
  const date = sp.date || todayISO();

  const [students, savedMap] = await Promise.all([
    listStudents(db, { classId }),
    getAttendanceMap(db, classId, date),
  ]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">উপস্থিতি</Typography>
      <AttendanceClient
        classes={classes}
        classId={classId}
        date={date}
        students={students}
        savedMap={savedMap}
        smsEnabled={tenant.attendanceSmsEnabled}
      />
    </Stack>
  );
}
