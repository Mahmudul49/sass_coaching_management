import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, buildPaymentRows } from "@/lib/admin/queries";
import EmptyState from "@/components/ui/EmptyState";
import PaymentsClient from "@/components/admin/PaymentsClient";
import { currentMonth, currentYear } from "@/lib/format";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; year?: string; month?: string }>;
}) {
  const { db, tenant } = await requireAdmin();
  const classes = await listClasses(db);

  if (classes.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">পেমেন্ট</Typography>
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="আগে ক্লাস ও ফি স্ট্রাকচার তৈরি করুন"
            description="পেমেন্ট নেওয়ার আগে ক্লাস, ফি ও ছাত্র থাকতে হবে।"
          />
        </Card>
      </Stack>
    );
  }

  const sp = await searchParams;
  const classId = sp.classId || classes[0].id;
  const year = Number(sp.year) || currentYear();
  const month = Number(sp.month) || currentMonth();
  const className = classes.find((c) => c.id === classId)?.name ?? "";

  const { template, rows } = await buildPaymentRows(db, classId, year, month);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">পেমেন্ট</Typography>
      <PaymentsClient
        classes={classes}
        className={className}
        classId={classId}
        year={year}
        month={month}
        template={template}
        rows={rows}
        centerName={tenant.name}
      />
    </Stack>
  );
}
