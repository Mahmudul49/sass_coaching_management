import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, buildPaymentRows } from "@/lib/admin/queries";
import EmptyState from "@/components/ui/EmptyState";
import PaymentsClient from "@/components/admin/PaymentsClient";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { currentMonth, currentYear } from "@/lib/format";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ classId?: string; year?: string; month?: string }>;
}) {
  const { tenant: slug } = await params;
  const { db, tenant } = await requireAdmin(slug);
  const classes = await listClasses(db);

  if (classes.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5">Payments</Typography>
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="Create classes and a fee structure first"
            description="You need classes, fees and students before you can take payments."
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
    <I18nProvider initialLocale="en">
    <Stack spacing={2}>
      <Typography variant="h5">Payments</Typography>
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
    </I18nProvider>
  );
}
