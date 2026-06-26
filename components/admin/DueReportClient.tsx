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
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import {
  DataGrid,
  GridToolbarQuickFilter,
  GridToolbarContainer,
  GridToolbarFilterButton,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { exportToExcel } from "@/lib/excel";
import type { ClassRow, DueRow } from "@/lib/admin/queries";
import { BN_MONTHS, monthName, taka, yearOptions, toBnDigits } from "@/lib/format";

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1, gap: 1 }}>
      <GridToolbarFilterButton />
      <Box sx={{ flex: 1 }} />
      <GridToolbarQuickFilter placeholder="খুঁজুন..." />
    </GridToolbarContainer>
  );
}

export default function DueReportClient({
  classes,
  classId,
  year,
  month,
  status,
  rows,
}: {
  classes: ClassRow[];
  classId: string;
  year: number;
  month: number;
  status: string;
  rows: DueRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(next: { classId?: string; year?: number; month?: number; status?: string }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? classId);
    params.set("year", String(next.year ?? year));
    params.set("month", String(next.month ?? month));
    params.set("status", next.status ?? status);
    router.push(`${pathname}?${params.toString()}`);
  }

  const totalDue = useMemo(() => rows.reduce((s, r) => s + r.due, 0), [rows]);
  const totalPaid = useMemo(() => rows.reduce((s, r) => s + r.paid, 0), [rows]);

  const columns = useMemo<GridColDef<DueRow>[]>(
    () => [
      { field: "roll", headerName: "রোল", width: 80 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 140 },
      { field: "className", headerName: "ক্লাস", width: 110 },
      { field: "sectionName", headerName: "শাখা", width: 90 },
      {
        field: "total",
        headerName: "মোট",
        width: 110,
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "paid",
        headerName: "পরিশোধিত",
        width: 120,
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "due",
        headerName: "বাকি",
        width: 110,
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "status",
        headerName: "অবস্থা",
        width: 110,
        renderCell: (p: GridRenderCellParams<DueRow>) => {
          if (p.row.status === "paid") return <Chip size="small" color="success" label="পরিশোধিত" />;
          if (p.row.status === "partial") return <Chip size="small" color="warning" label="আংশিক" />;
          return <Chip size="small" color="error" label="বাকি" />;
        },
      },
    ],
    []
  );

  function downloadExcel() {
    const data = rows.map((r) => ({
      Roll: r.roll,
      Name: r.name,
      Class: r.className,
      Section: r.sectionName,
      Total: r.total,
      Paid: r.paid,
      Due: r.due,
      Status: r.status,
    }));
    exportToExcel(`due-report-${monthName(month)}-${year}`, data, "DueReport");
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField select label="ক্লাস" value={classId} onChange={(e) => navigate({ classId: e.target.value })}>
              <MenuItem value="">সব ক্লাস</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="মাস" value={month} onChange={(e) => navigate({ month: Number(e.target.value) })}>
              {BN_MONTHS.map((m, i) => (
                <MenuItem key={i} value={i + 1}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="বছর" value={year} onChange={(e) => navigate({ year: Number(e.target.value) })}>
              {yearOptions().map((y) => (
                <MenuItem key={y} value={y}>
                  {toBnDigits(y)}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="অবস্থা" value={status} onChange={(e) => navigate({ status: e.target.value })}>
              <MenuItem value="">সব</MenuItem>
              <MenuItem value="paid">পরিশোধিত</MenuItem>
              <MenuItem value="partial">আংশিক</MenuItem>
              <MenuItem value="unpaid">বাকি</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap flexWrap="wrap">
        <Chip color="error" sx={{ fontSize: 16, py: 2.4, px: 1 }} label={`মোট বকেয়া: ${taka(totalDue)}`} />
        <Chip color="success" sx={{ fontSize: 16, py: 2.4, px: 1 }} label={`মোট আদায়: ${taka(totalPaid)}`} />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<DownloadIcon />} onClick={downloadExcel} disabled={rows.length === 0}>
          Excel ডাউনলোড
        </Button>
      </Stack>

      <Card sx={{ p: { xs: 1, sm: 2 } }}>
        {rows.length === 0 ? (
          <EmptyState
            title="কোনো রেকর্ড নেই"
            description="এই মাসে এখনো কোনো পেমেন্ট সংরক্ষণ করা হয়নি।"
          />
        ) : (
          <Box sx={{ width: "100%" }}>
            <DataGrid
              autoHeight
              rows={rows}
              columns={columns}
              slots={{ toolbar: Toolbar }}
              disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              pageSizeOptions={[25, 50, 100]}
              sx={{ border: 0 }}
            />
          </Box>
        )}
      </Card>
    </Stack>
  );
}
