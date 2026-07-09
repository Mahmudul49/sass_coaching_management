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
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Collapse from "@mui/material/Collapse";
import LinearProgress from "@mui/material/LinearProgress";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { savePayment } from "@/app/[tenant]/admin/actions/payments";
import { useI18n } from "@/components/providers/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
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
  remarks: string;
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
      remarks: r.remarks ?? "",
      saved: r.saved,
    };
    for (const c of template) row[c.key] = r.amounts[c.key] ?? 0;
    return row;
  });
}

function statusChip(total: number, paid: number, t: (k: MessageKey) => string) {
  if (paid <= 0) return <Chip size="small" label={t("c_due")} color="error" />;
  if (paid >= total) return <Chip size="small" label={t("c_paid")} color="success" />;
  return <Chip size="small" label={t("c_partial")} color="warning" />;
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
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => flatten(initialRows, template));
  const [mobileQ, setMobileQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // Mobile-only filter (name/roll) for quick lookup in a long class list.
  const mobileRows = mobileQ.trim()
    ? rows.filter((r) => `${r.name} ${r.roll}`.toLowerCase().includes(mobileQ.trim().toLowerCase()))
    : rows;

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

  // Live progress summary across the class (for the mobile summary card).
  const summary = rows.reduce(
    (a, r) => {
      const t = rowTotal(r);
      const p = Number(r.paidAmount) || 0;
      a.expected += t;
      a.collected += p;
      if (p <= 0) a.unpaid += 1;
      else if (p >= t) a.paid += 1;
      else a.partial += 1;
      return a;
    },
    { expected: 0, collected: 0, paid: 0, partial: 0, unpaid: 0 }
  );
  const collectedPct = summary.expected > 0 ? Math.round((summary.collected / summary.expected) * 100) : 0;

  const markAllFull = () => setRows((rs) => rs.map((r) => ({ ...r, paidAmount: rowTotal(r) })));

  const processRowUpdate = useCallback((updated: Row) => {
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    return updated;
  }, []);

  const setPaid = (id: string, value: number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, paidAmount: value } : r)));

  const setRemarks = (id: string, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, remarks: value } : r)));

  // Admin override of a single fee sector (mobile card). 0 = waive that sector.
  const setAmount = (id: string, key: string, value: number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: Math.max(0, value) } : r)));

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
      remarks: String(row.remarks ?? ""),
    });
  }

  function saveRow(row: Row) {
    start(async () => {
      const res = await persist(row);
      if (res.ok) {
        toast.success(`${row.name} — ${t("pay_saved")}`);
        router.refresh();
      } else toast.error(res.error ?? t("c_something_wrong"));
    });
  }

  function saveAll() {
    start(async () => {
      let okCount = 0;
      for (const row of rows) {
        const res = await persist(row);
        if (res.ok) okCount++;
      }
      toast.success(`${toBnDigits(okCount)} ${t("pay_saved_n")}`);
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
      remarks: String(row.remarks ?? ""),
    };
  }
  const receipt = (row: Row) => printReceipt(buildReceipt(row));
  const whatsapp = (row: Row) => shareReceiptWhatsApp(buildReceipt(row), row.phone);

  // Fully-paid checkbox: check = pay the full computed total; uncheck = clear.
  const setFullPaid = (row: Row, full: boolean) => setPaid(row.id, full ? rowTotal(row) : 0);

  const columns = useMemo<GridColDef<Row>[]>(() => {
    const base: GridColDef<Row>[] = [
      { field: "roll", headerName: t("c_roll"), width: 70 },
      { field: "name", headerName: t("c_name"), flex: 1, minWidth: 130 },
      { field: "sectionName", headerName: t("c_section"), width: 70 },
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
        headerName: t("c_total"),
        width: 110,
        valueGetter: (_v, row) => rowTotal(row),
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "full",
        headerName: t("pay_full"),
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
        headerName: t("c_paid"),
        width: 110,
        editable: true,
        type: "number",
        valueFormatter: (v: number) => taka(Number(v) || 0),
      },
      {
        field: "status",
        headerName: t("c_status"),
        width: 110,
        renderCell: (p: GridRenderCellParams<Row>) =>
          statusChip(rowTotal(p.row), Number(p.row.paidAmount) || 0, t),
      },
      {
        field: "remarks",
        headerName: t("c_remarks_opt"),
        width: 200,
        editable: true,
      },
      {
        field: "actions",
        headerName: t("c_action"),
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (p: GridRenderCellParams<Row>) => (
          <>
            <Tooltip title={t("pay_save")}>
              <IconButton size="small" color="primary" onClick={() => saveRow(p.row)} disabled={pending}>
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("pay_print_receipt")}>
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
  }, [template, rowTotal, pending, t]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr 1fr", sm: "2fr 1fr 1fr" },
            }}
          >
            <TextField
              select
              label={t("c_class")}
              value={classId}
              onChange={(e) => navigate({ classId: e.target.value })}
              sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField select label={t("c_month")} value={month} onChange={(e) => navigate({ month: Number(e.target.value) })}>
              {BN_MONTHS.map((m, i) => (
                <MenuItem key={i} value={i + 1}>{m}</MenuItem>
              ))}
            </TextField>
            <TextField select label={t("c_year")} value={year} onChange={(e) => navigate({ year: Number(e.target.value) })}>
              {yearOptions().map((y) => (
                <MenuItem key={y} value={y}>{toBnDigits(y)}</MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState title={t("pay_no_students")} description={t("pay_pick_other")} />
        </Card>
      ) : (
        <>
          {/* Mobile: progress summary + quick search + student cards */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 1.75 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t("pay_collected")}
                    </Typography>
                    <Typography fontWeight={700} sx={{ fontSize: "0.95rem", fontVariantNumeric: "tabular-nums" }} noWrap>
                      {taka(summary.collected)} / {taka(summary.expected)}
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight={800} color="success.main" sx={{ lineHeight: 1 }}>
                    {toBnDigits(collectedPct)}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={collectedPct} color="success" sx={{ height: 10, borderRadius: 5 }} />
                <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} useFlexGap>
                  <Chip size="small" color="success" variant="outlined" label={`${t("c_paid")} ${toBnDigits(summary.paid)}`} sx={{ flex: 1 }} />
                  <Chip size="small" color="warning" variant="outlined" label={`${t("c_partial")} ${toBnDigits(summary.partial)}`} sx={{ flex: 1 }} />
                  <Chip size="small" color="error" variant="outlined" label={`${t("c_due")} ${toBnDigits(summary.unpaid)}`} sx={{ flex: 1 }} />
                </Stack>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<DoneAllIcon />}
                  onClick={markAllFull}
                  sx={{ mt: 1.5 }}
                >
                  {t("pay_mark_all_full")}
                </Button>
              </CardContent>
            </Card>

            <TextField
              fullWidth
              size="small"
              placeholder={t("pay_search")}
              value={mobileQ}
              onChange={(e) => setMobileQ(e.target.value)}
              sx={{ mb: 1.5 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />

            <Stack spacing={1.5}>
            {mobileRows.map((row) => {
              const total = rowTotal(row);
              const paid = Number(row.paidAmount) || 0;
              const isFull = total > 0 && paid >= total;
              const due = Math.max(0, total - paid);
              return (
                <Card
                  key={row.id}
                  sx={{
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 6px 22px -12px rgba(18,36,31,0.28)",
                  }}
                >
                  {/* Header strip */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      background: "linear-gradient(135deg, #0A5A4E 0%, #0F7A6B 100%)",
                      color: "#fff",
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: "rgba(255,255,255,0.20)",
                        color: "#fff",
                        fontWeight: 700,
                        width: 44,
                        height: 44,
                        border: "2px solid rgba(255,255,255,0.35)",
                      }}
                    >
                      {row.name?.trim()?.[0] ?? "?"}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={700} noWrap sx={{ fontSize: "1.05rem" }}>{row.name}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {t("c_roll")} {toBnDigits(row.roll)} · {t("c_section")} {row.sectionName}
                      </Typography>
                    </Box>
                    {statusChip(total, paid, t)}
                  </Box>

                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    {/* Summary: total / paid / due — soft stat pills that wrap, never clip */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 1,
                        mb: 1.75,
                      }}
                    >
                      {[
                        { l: t("c_total"), v: taka(total), c: "text.primary", bg: "rgba(18,36,31,0.04)", bd: "divider" },
                        { l: t("c_paid"), v: taka(paid), c: "success.main", bg: "rgba(22,163,74,0.10)", bd: "rgba(22,163,74,0.25)" },
                        {
                          l: t("c_due"),
                          v: taka(due),
                          c: due > 0 ? "error.main" : "text.secondary",
                          bg: due > 0 ? "rgba(220,38,38,0.08)" : "rgba(18,36,31,0.04)",
                          bd: due > 0 ? "rgba(220,38,38,0.22)" : "divider",
                        },
                      ].map((s) => (
                        <Box
                          key={s.l}
                          sx={{
                            py: 1.1,
                            px: 0.5,
                            textAlign: "center",
                            borderRadius: 2,
                            bgcolor: s.bg,
                            border: "1px solid",
                            borderColor: s.bd,
                          }}
                        >
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 0.25 }}>
                            {s.l}
                          </Typography>
                          <Typography sx={{ color: s.c, fontWeight: 800, fontSize: { xs: "0.9rem", sm: "1rem" }, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
                            {s.v}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Quick full-pay: one tap collects the full computed amount */}
                    <Button
                      fullWidth
                      variant={isFull ? "contained" : "outlined"}
                      color="success"
                      startIcon={<DoneAllIcon />}
                      onClick={() => setFullPaid(row, !isFull)}
                      sx={{ mb: 1.25, py: 1.15, borderRadius: 2.5, fontWeight: 700 }}
                    >
                      {isFull ? t("pay_full_done") : t("pay_full")}
                    </Button>

                    {/* Collapsible itemized breakdown — expand only to override a sector */}
                    <Button
                      fullWidth
                      size="small"
                      variant="text"
                      startIcon={<TuneIcon />}
                      onClick={() => toggleExpand(row.id)}
                      sx={{ justifyContent: "flex-start", color: "text.secondary", mb: 0.5 }}
                    >
                      {expanded[row.id] ? t("pay_hide_fees") : t("pay_edit_fees")}
                    </Button>
                    <Collapse in={!!expanded[row.id]}>
                      <Stack
                        spacing={0}
                        sx={{ mb: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}
                        divider={<Divider flexItem />}
                      >
                        {template.map((c) => (
                          <Stack key={c.key} direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 0.75 }}>
                            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                              {c.label}
                            </Typography>
                            <TextField
                              type="number"
                              size="small"
                              value={Number(row[c.key]) || 0}
                              onChange={(e) => setAmount(row.id, c.key, Number(e.target.value))}
                              inputProps={{ inputMode: "numeric", min: 0, style: { textAlign: "right" } }}
                              InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
                              sx={{ width: 118, flexShrink: 0 }}
                            />
                          </Stack>
                        ))}
                      </Stack>
                    </Collapse>
                    <TextField
                      label={t("pay_amount")}
                      type="number"
                      fullWidth
                      value={row.paidAmount}
                      onChange={(e) => setPaid(row.id, Number(e.target.value))}
                      inputProps={{ inputMode: "numeric", min: 0 }}
                      InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
                      sx={{ mt: 0.5 }}
                    />
                    <TextField
                      label={t("pay_progress_remarks")}
                      size="small"
                      fullWidth
                      multiline
                      value={row.remarks}
                      onChange={(e) => setRemarks(row.id, e.target.value)}
                      sx={{ mt: 1.25 }}
                    />

                    <Stack direction="row" spacing={1} sx={{ mt: 1.75 }} alignItems="center">
                      <Button
                        fullWidth
                        size="large"
                        startIcon={<SaveIcon />}
                        onClick={() => saveRow(row)}
                        disabled={pending}
                        sx={{ borderRadius: 2.5 }}
                      >
                        {t("pay_save")}
                      </Button>
                      <Tooltip title={t("pay_receipt")}>
                        <IconButton color="primary" onClick={() => receipt(row)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, width: 48, height: 48 }}>
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="WhatsApp">
                        <IconButton onClick={() => whatsapp(row)} sx={{ color: "#25D366", border: "1px solid", borderColor: "divider", borderRadius: 2, width: 48, height: 48 }}>
                          <WhatsAppIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
            </Stack>
          </Box>

          {/* Desktop: editable grid (scrolls within the card, never the page) */}
          <Card sx={{ p: { xs: 1, sm: 2 }, display: { xs: "none", md: "block" } }}>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Box sx={{ minWidth: 720 }}>
                <DataGrid
                  autoHeight
                  rows={rows}
                  columns={columns}
                  processRowUpdate={processRowUpdate}
                  onProcessRowUpdateError={() => toast.error(t("pay_update_failed"))}
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
              px: { xs: 1.5, sm: 2 },
              py: 1.25,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                {toBnDigits(rows.length)} {t("students_word")}
              </Typography>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ fontVariantNumeric: "tabular-nums" }}>
                {toBnDigits(collectedPct)}% · {taka(summary.collected)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<SaveIcon />} onClick={saveAll} disabled={pending} size="large">
              {pending ? t("pay_saving") : t("pay_save_all")}
            </Button>
          </Paper>
        </>
      )}
    </Stack>
  );
}
