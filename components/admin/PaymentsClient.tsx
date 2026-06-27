"use client";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { savePayment } from "@/app/[tenant]/admin/actions/payments";
import { printReceipt } from "@/lib/receipt";
import type { ClassRow, PayColumn, PayRow } from "@/lib/admin/queries";
import { BN_MONTHS, taka, yearOptions, toBnDigits } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  roll: string;
  sectionName: string;
  phone: string;
  paidAmount: number;
  saved: boolean;
  [key: string]: string | number | boolean;
};

function flatten(rows: PayRow[], template: PayColumn[]): Row[] {
  return rows.map((r) => {
    const row: Row = {
      id: r.id,
      name: r.name,
      roll: r.roll,
      sectionName: r.sectionName,
      phone: r.phone,
      paidAmount: Number(r.paidAmount) || 0,
      saved: r.saved,
    };
    for (const c of template) row[c.key] = r.amounts[c.key] ?? 0;
    return row;
  });
}

export default function PaymentsClient({
  classes,
  className,
  classId,
  year,
  month,
  template,
  rows: initialRows,
  centerName,
}: {
  classes: ClassRow[];
  className: string;
  classId: string;
  year: number;
  month: number;
  template: PayColumn[];
  rows: PayRow[];
  centerName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => flatten(initialRows, template));

  function navigate(next: { classId?: string; year?: number; month?: number }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? classId);
    params.set("year", String(next.year ?? year));
    params.set("month", String(next.month ?? month));
    router.push(`${pathname}?${params.toString()}`);
  }

  const rowTotal = useCallback(
    (row: Row) => template.reduce((sum, c) => sum + (Number(row[c.key]) || 0), 0),
    [template]
  );

  const processRowUpdate = useCallback((updated: Row) => {
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    return updated;
  }, []);

  function buildComponents(row: Row) {
    return template.map((c) => ({
      type: c.type,
      label: c.label,
      amount: Number(row[c.key]) || 0,
    }));
  }

  function saveRow(row: Row) {
    start(async () => {
      const res = await savePayment({
        studentId: row.id,
        classId,
        year,
        month,
        components: buildComponents(row),
        paidAmount: Number(row.paidAmount) || 0,
      });
      if (res.ok) {
        toast.success(`${row.name} — পেমেন্ট সংরক্ষিত (SMS পাঠানো হয়েছে)।`);
        router.refresh();
      } else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function saveAll() {
    start(async () => {
      let okCount = 0;
      for (const row of rows) {
        const res = await savePayment({
          studentId: row.id,
          classId,
          year,
          month,
          components: buildComponents(row),
          paidAmount: Number(row.paidAmount) || 0,
        });
        if (res.ok) okCount++;
      }
      toast.success(`${toBnDigits(okCount)} জনের পেমেন্ট সংরক্ষিত হয়েছে।`);
      router.refresh();
    });
  }

  function receipt(row: Row) {
    printReceipt({
      centerName,
      studentName: row.name,
      roll: row.roll,
      className,
      sectionName: row.sectionName,
      month,
      year,
      lines: template.map((c) => ({ label: c.label, amount: Number(row[c.key]) || 0 })),
      total: rowTotal(row),
      paid: Number(row.paidAmount) || 0,
    });
  }

  const columns = useMemo<GridColDef<Row>[]>(() => {
    const base: GridColDef<Row>[] = [
      { field: "roll", headerName: "রোল", width: 70 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 130 },
      { field: "sectionName", headerName: "শাখা", width: 50 },
    ];
    const compCols: GridColDef<Row>[] = template.map((c) => ({
      field: c.key,
      headerName: c.label,
      width: 120,
      editable: true,
      type: "number",
      valueFormatter: (v: number) => taka(Number(v) || 0),
    }));
    const tail: GridColDef<Row>[] = [
      {
        field: "total",
        headerName: "মোট",
        width: 120,
        valueGetter: (_v, row) => rowTotal(row),
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "paidAmount",
        headerName: "পরিশোধিত",
        width: 100,
        editable: true,
        type: "number",
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "status",
        headerName: "অবস্থা",
        width: 110,
        renderCell: (p: GridRenderCellParams<Row>) => {
          const total = rowTotal(p.row);
          const paid = Number(p.row.paidAmount) || 0;
          if (paid <= 0) return <Chip size="small" label="বাকি" color="error" />;
          if (paid >= total) return <Chip size="small" label="পরিশোধিত" color="success" />;
          return <Chip size="small" label="আংশিক" color="warning" />;
        },
      },
      {
        field: "actions",
        headerName: "অ্যাকশন",
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (p: GridRenderCellParams<Row>) => (
          <>
            <Tooltip title="সংরক্ষণ">
              <IconButton size="small" color="primary" onClick={() => saveRow(p.row)} disabled={pending}>
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="রসিদ প্রিন্ট">
              <IconButton size="small" onClick={() => receipt(p.row)}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ),
      },
    ];
    return [...base, ...compCols, ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, rowTotal, pending]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="ক্লাস" value={classId} onChange={(e) => navigate({ classId: e.target.value })}>
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
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ p: { xs: 1, sm: 2 } }}>
        {rows.length === 0 ? (
          <EmptyState
            title="এই ক্লাসে কোনো ছাত্র নেই"
            description="অন্য ক্লাস নির্বাচন করুন অথবা ছাত্র যোগ করুন।"
          />
        ) : (
          <>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <Button startIcon={<SaveIcon />} onClick={saveAll} disabled={pending}>
                সবার পেমেন্ট সংরক্ষণ
              </Button>
            </Stack>
            <Box sx={{ width: "100%" }}>
              <DataGrid
                autoHeight
                rows={rows}
                columns={columns}
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={() => toast.error("আপডেট ব্যর্থ হয়েছে।")}
                disableRowSelectionOnClick
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                pageSizeOptions={[25, 50, 100]}
                sx={{ border: 0 }}
              />
            </Box>
          </>
        )}
      </Card>
    </Stack>
  );
}
