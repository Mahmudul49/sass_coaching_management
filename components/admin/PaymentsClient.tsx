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
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { savePayment } from "@/app/[tenant]/admin/actions/payments";
import { printReceipt, shareReceiptWhatsApp, type ReceiptData } from "@/lib/receipt";
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

function statusChip(total: number, paid: number) {
  if (paid <= 0) return <Chip size="small" label="বাকি" color="error" />;
  if (paid >= total) return <Chip size="small" label="পরিশোধিত" color="success" />;
  return <Chip size="small" label="আংশিক" color="warning" />;
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

  const setPaid = (id: string, value: number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, paidAmount: value } : r)));

  function buildComponents(row: Row) {
    return template.map((c) => ({ type: c.type, label: c.label, amount: Number(row[c.key]) || 0 }));
  }

  function persist(row: Row) {
    return savePayment({
      studentId: row.id,
      classId,
      year,
      month,
      components: buildComponents(row),
      paidAmount: Number(row.paidAmount) || 0,
    });
  }

  function saveRow(row: Row) {
    start(async () => {
      const res = await persist(row);
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
        const res = await persist(row);
        if (res.ok) okCount++;
      }
      toast.success(`${toBnDigits(okCount)} জনের পেমেন্ট সংরক্ষিত হয়েছে।`);
      router.refresh();
    });
  }

  function buildReceipt(row: Row): ReceiptData {
    return {
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
    };
  }
  const receipt = (row: Row) => printReceipt(buildReceipt(row));
  const whatsapp = (row: Row) => shareReceiptWhatsApp(buildReceipt(row), row.phone);

  // Fully-paid checkbox: check = pay the full computed total; uncheck = clear.
  const setFullPaid = (row: Row, full: boolean) => setPaid(row.id, full ? rowTotal(row) : 0);

  const columns = useMemo<GridColDef<Row>[]>(() => {
    const base: GridColDef<Row>[] = [
      { field: "roll", headerName: "রোল", width: 70 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 130 },
      { field: "sectionName", headerName: "শাখা", width: 70 },
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
        width: 110,
        valueGetter: (_v, row) => rowTotal(row),
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "full",
        headerName: "সম্পূর্ণ",
        width: 90,
        sortable: false,
        filterable: false,
        renderCell: (p: GridRenderCellParams<Row>) => {
          const total = rowTotal(p.row);
          const paid = Number(p.row.paidAmount) || 0;
          return (
            <Checkbox
              size="small"
              checked={total > 0 && paid >= total}
              onChange={(e) => setFullPaid(p.row, e.target.checked)}
            />
          );
        },
      },
      {
        field: "paidAmount",
        headerName: "পরিশোধিত",
        width: 110,
        editable: true,
        type: "number",
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "status",
        headerName: "অবস্থা",
        width: 110,
        renderCell: (p: GridRenderCellParams<Row>) =>
          statusChip(rowTotal(p.row), Number(p.row.paidAmount) || 0),
      },
      {
        field: "actions",
        headerName: "অ্যাকশন",
        width: 140,
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
            <Tooltip title="WhatsApp">
              <IconButton size="small" sx={{ color: "#25D366" }} onClick={() => whatsapp(p.row)}>
                <WhatsAppIcon fontSize="small" />
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
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField select label="মাস" value={month} onChange={(e) => navigate({ month: Number(e.target.value) })}>
              {BN_MONTHS.map((m, i) => (
                <MenuItem key={i} value={i + 1}>{m}</MenuItem>
              ))}
            </TextField>
            <TextField select label="বছর" value={year} onChange={(e) => navigate({ year: Number(e.target.value) })}>
              {yearOptions().map((y) => (
                <MenuItem key={y} value={y}>{toBnDigits(y)}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState title="এই ক্লাসে কোনো শিক্ষার্থী নেই" description="অন্য ক্লাস নির্বাচন করুন অথবা শিক্ষার্থী যোগ করুন।" />
        </Card>
      ) : (
        <>
          {/* Mobile: one card per student — enter how much was paid */}
          <Stack spacing={1.25} sx={{ display: { xs: "flex", md: "none" } }}>
            {rows.map((row) => {
              const total = rowTotal(row);
              const paid = Number(row.paidAmount) || 0;
              return (
                <Card key={row.id} variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={700} noWrap>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          রোল {toBnDigits(row.roll)} · {row.sectionName} · মোট {taka(total)}
                        </Typography>
                      </Box>
                      {statusChip(total, paid)}
                    </Stack>
                    <FormControlLabel
                      sx={{ mt: 0.5 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={total > 0 && paid >= total}
                          onChange={(e) => setFullPaid(row, e.target.checked)}
                        />
                      }
                      label="সম্পূর্ণ পরিশোধিত"
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                      <TextField
                        label="পরিশোধিত"
                        type="number"
                        size="small"
                        value={row.paidAmount}
                        onChange={(e) => setPaid(row.id, Number(e.target.value))}
                        inputProps={{ inputMode: "numeric", min: 0 }}
                        sx={{ maxWidth: 130 }}
                      />
                      <Box sx={{ flex: 1 }} />
                      <Tooltip title="রসিদ">
                        <IconButton onClick={() => receipt(row)}><PrintIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="WhatsApp">
                        <IconButton sx={{ color: "#25D366" }} onClick={() => whatsapp(row)}>
                          <WhatsAppIcon />
                        </IconButton>
                      </Tooltip>
                      <Button startIcon={<SaveIcon />} onClick={() => saveRow(row)} disabled={pending}>
                        সেভ
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          {/* Desktop: editable grid (scrolls within the card, never the page) */}
          <Card sx={{ p: { xs: 1, sm: 2 }, display: { xs: "none", md: "block" } }}>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box sx={{ minWidth: 720 }}>
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
            </Box>
          </Card>

          {/* Sticky save-all bar */}
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
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              {toBnDigits(rows.length)} জন শিক্ষার্থী
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<SaveIcon />} onClick={saveAll} disabled={pending} size="large">
              {pending ? "সংরক্ষণ..." : "সবার পেমেন্ট সংরক্ষণ"}
            </Button>
          </Paper>
        </>
      )}
    </Stack>
  );
}
