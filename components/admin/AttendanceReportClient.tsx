"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import { exportAoa } from "@/lib/excel";
import { printReportTable } from "@/lib/print";
import type { ClassRow, AttendanceReportRow } from "@/lib/admin/queries";
import { loadAttendanceReport } from "@/app/[tenant]/admin/actions/reports";
import { toBnDigits as bnFmt } from "@/lib/format";
import { useI18n } from "@/components/providers/I18nProvider";
import { useToast } from "@/components/providers/ToastProvider";

export default function AttendanceReportClient({
  classes,
  classId: classIdProp,
  from: fromProp,
  to: toProp,
  days: daysProp,
  rows: rowsProp,
  centerName,
  className: classNameProp,
}: {
  classes: ClassRow[];
  classId: string;
  from: string;
  to: string;
  days: number;
  rows: AttendanceReportRow[];
  centerName: string;
  className: string;
}) {
  const { t, locale } = useI18n();
  const toBnDigits = (v: string | number) => bnFmt(v, locale);
  const toast = useToast();
  const pathname = usePathname();

  // Filters + derived data are LOCAL state now: changing a filter fetches the
  // new report in place via a server action (no router.push / no reload). The URL
  // is kept in sync with history.replaceState so refresh/bookmark still work.
  const [classId, setClassId] = useState(classIdProp);
  const [from, setFrom] = useState(fromProp);
  const [to, setTo] = useState(toProp);
  const [rows, setRows] = useState<AttendanceReportRow[]>(rowsProp);
  const [days, setDays] = useState(daysProp);
  const [className, setClassName] = useState(classNameProp);
  const [loadingData, startLoad] = useTransition();

  // A fresh server render (switching back to this tab, or a hard load with URL
  // params) resets all local state back to the server-provided values.
  useEffect(() => {
    setClassId(classIdProp);
    setFrom(fromProp);
    setTo(toProp);
    setRows(rowsProp);
    setDays(daysProp);
    setClassName(classNameProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsProp]);

  function applyFilter(next: { classId?: string; from?: string; to?: string }) {
    const cId = next.classId ?? classId;
    const f = next.from ?? from;
    const to_ = next.to ?? to;
    setClassId(cId);
    setFrom(f);
    setTo(to_);
    startLoad(async () => {
      try {
        const res = await loadAttendanceReport(cId, f, to_);
        setRows(res.rows);
        setDays(res.days);
        setClassName(res.className);
        const p = new URLSearchParams({ tab: "attendance", classId: cId, from: f, to: to_ });
        window.history.replaceState(null, "", `${pathname}?${p.toString()}`);
      } catch {
        toast.error(t("c_something_wrong"));
      }
    });
  }

  const columns = useMemo<GridColDef<AttendanceReportRow>[]>(
    () => [
      { field: "roll", headerName: t("c_roll"), width: 90 },
      { field: "name", headerName: t("c_name"), flex: 1, minWidth: 140 },
      { field: "sectionName", headerName: t("c_section"), width: 90 },
      { field: "present", headerName: t("ar_present"), width: 100, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      { field: "absent", headerName: t("ar_absent"), width: 110, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      { field: "total", headerName: t("ar_total_days"), width: 100, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      {
        field: "pct",
        headerName: t("ar_rate"),
        width: 100,
        renderCell: (p) => (
          <Chip
            size="small"
            color={p.row.pct >= 80 ? "success" : p.row.pct >= 50 ? "warning" : "error"}
            label={`${toBnDigits(p.row.pct)}%`}
          />
        ),
      },
    ],
    [t]
  );

  function exportExcel() {
    const header = ["ROLL", "NAME", "SECTION", "PRESENT", "ABSENT", "TOTAL", "PERCENT"];
    const body = rows.map((r) => [r.roll, r.name, r.sectionName, r.present, r.absent, r.total, `${r.pct}%`]);
    exportAoa(`attendance-${from}_to_${to}`, [
      ["Attendance Report"],
      [`Institution : ${centerName}`],
      [`Class : ${className}`],
      [`From : ${from}`],
      [`To : ${to}`],
      [],
      header,
      ...body,
    ]);
  }

  function printReport() {
    printReportTable({
      title: centerName,
      subtitle: `Attendance Report — ${className}`,
      meta: [`From: ${from}`, `To: ${to}`],
      head: ["Roll", "Name", "Section", "Present", "Absent", "Total", "Rate"],
      rows: rows.map((r) => [r.roll, r.name, r.sectionName, r.present, r.absent, r.total, `${r.pct}%`]),
      numericFrom: 3,
    });
  }

  const renderCard = (r: AttendanceReportRow) => (
    <DataCard
      title={r.name}
      subtitle={`${t("c_roll")} ${toBnDigits(r.roll)} · ${t("c_section")} ${r.sectionName}`}
      right={
        <Chip
          size="small"
          color={r.pct >= 80 ? "success" : r.pct >= 50 ? "warning" : "error"}
          label={`${toBnDigits(r.pct)}%`}
        />
      }
      fields={[
        { label: t("ar_present"), value: toBnDigits(r.present) },
        { label: t("ar_absent"), value: toBnDigits(r.absent) },
        { label: t("c_total"), value: toBnDigits(r.total) },
      ]}
    />
  );

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap flexWrap="wrap">
            <TextField select label={t("c_class")} value={classId} disabled={loadingData} onChange={(e) => applyFilter({ classId: e.target.value })} sx={{ minWidth: 150 }}>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField type="date" label={t("r_from")} value={from} disabled={loadingData} onChange={(e) => applyFilter({ from: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
            <TextField type="date" label={t("r_to")} value={to} disabled={loadingData} onChange={(e) => applyFilter({ to: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          </Stack>
          {loadingData && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
        <Chip color="primary" sx={{ fontWeight: 700 }} label={`${t("ar_class_days")}: ${toBnDigits(days)}`} />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportExcel} disabled={rows.length === 0}>
          {t("export_excel")}
        </Button>
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={printReport} disabled={rows.length === 0}>
          {t("ar_print")}
        </Button>
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        {rows.length === 0 ? (
          <EmptyState title={t("ar_empty")} description={t("ar_empty_desc")} />
        ) : (
          <ResponsiveTable
            rows={rows}
            columns={columns}
            renderCard={renderCard}
            filterText={(r) => `${r.name} ${r.roll} ${r.sectionName}`}
            gridMinWidth={720}
          />
        )}
      </Card>
    </Stack>
  );
}
