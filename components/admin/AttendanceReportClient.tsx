"use client";
import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import { exportAoa } from "@/lib/excel";
import type { ClassRow, AttendanceReportRow } from "@/lib/admin/queries";
import { toBnDigits } from "@/lib/format";

export default function AttendanceReportClient({
  classes,
  classId,
  from,
  to,
  days,
  rows,
  centerName,
  className,
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
  const router = useRouter();
  const pathname = usePathname();

  function navigate(next: { classId?: string; from?: string; to?: string }) {
    const p = new URLSearchParams();
    p.set("tab", "attendance");
    p.set("classId", next.classId ?? classId);
    p.set("from", next.from ?? from);
    p.set("to", next.to ?? to);
    router.push(`${pathname}?${p.toString()}`);
  }

  const columns = useMemo<GridColDef<AttendanceReportRow>[]>(
    () => [
      { field: "roll", headerName: "রোল", width: 90 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 140 },
      { field: "sectionName", headerName: "শাখা", width: 90 },
      { field: "present", headerName: "উপস্থিত", width: 100, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      { field: "absent", headerName: "অনুপস্থিত", width: 110, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      { field: "total", headerName: "মোট দিন", width: 100, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      {
        field: "pct",
        headerName: "হার",
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
    []
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
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const body = rows
      .map(
        (r) =>
          `<tr><td>${toBnDigits(r.roll)}</td><td>${r.name}</td><td>${r.sectionName}</td><td style="text-align:right">${toBnDigits(
            r.present
          )}</td><td style="text-align:right">${toBnDigits(r.absent)}</td><td style="text-align:right">${toBnDigits(
            r.total
          )}</td><td style="text-align:right">${toBnDigits(r.pct)}%</td></tr>`
      )
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Attendance Report</title>
      <style>body{font-family:'Hind Siliguri',sans-serif;padding:16px}h2,h4{text-align:center;margin:2px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{border:1px solid #ccc;padding:5px 7px}
      th{background:#f0f0f0}@media print{button{display:none}}</style></head>
      <body><h2>${centerName}</h2><h4>উপস্থিতি রিপোর্ট — ${className} (${toBnDigits(from)} → ${toBnDigits(to)})</h4>
      <table><thead><tr><th>রোল</th><th>নাম</th><th>শাখা</th><th>উপস্থিত</th><th>অনুপস্থিত</th><th>মোট</th><th>হার</th></tr></thead>
      <tbody>${body}</tbody></table>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()">প্রিন্ট</button></div></body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const renderCard = (r: AttendanceReportRow) => (
    <DataCard
      title={r.name}
      subtitle={`রোল ${toBnDigits(r.roll)} · শাখা ${r.sectionName}`}
      right={
        <Chip
          size="small"
          color={r.pct >= 80 ? "success" : r.pct >= 50 ? "warning" : "error"}
          label={`${toBnDigits(r.pct)}%`}
        />
      }
      fields={[
        { label: "উপস্থিত", value: toBnDigits(r.present) },
        { label: "অনুপস্থিত", value: toBnDigits(r.absent) },
        { label: "মোট", value: toBnDigits(r.total) },
      ]}
    />
  );

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap flexWrap="wrap">
            <TextField select label="ক্লাস" value={classId} onChange={(e) => navigate({ classId: e.target.value })} sx={{ minWidth: 150 }}>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField type="date" label="শুরু (From)" value={from} onChange={(e) => navigate({ from: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
            <TextField type="date" label="শেষ (To)" value={to} onChange={(e) => navigate({ to: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
        <Chip color="primary" sx={{ fontWeight: 700 }} label={`মোট ক্লাস দিন: ${toBnDigits(days)}`} />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportExcel} disabled={rows.length === 0}>
          Excel
        </Button>
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={printReport} disabled={rows.length === 0}>
          প্রিন্ট
        </Button>
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        {rows.length === 0 ? (
          <EmptyState title="কোনো তথ্য নেই" description="ক্লাস নির্বাচন করুন অথবা এই সময়সীমায় উপস্থিতি নেওয়া হয়নি।" />
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
