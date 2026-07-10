"use client";
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
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
import ClearIcon from "@mui/icons-material/Clear";
import TuneIcon from "@mui/icons-material/Tune";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { savePayment, savePaymentsBulk, loadPaymentRows } from "@/app/[tenant]/admin/actions/payments";
import { useI18n } from "@/components/providers/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { printReceipt, shareReceiptWhatsApp, type ReceiptData } from "@/lib/receipt";
import type { ClassRow, PayColumn, PayRow, PayExtra } from "@/lib/admin/queries";
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

/** Per-student custom fee lines, keyed by studentId (kept out of the grid row). */
function extrasFromRows(rows: PayRow[]): Record<string, PayExtra[]> {
  const map: Record<string, PayExtra[]> = {};
  for (const r of rows) if (r.extras?.length) map[r.id] = r.extras.map((e) => ({ ...e }));
  return map;
}

function statusChip(total: number, paid: number, t: (k: MessageKey) => string) {
  // Nothing payable this month (no fee configured / waived): not "Due" — there is
  // nothing to collect. Show a neutral chip (or Paid if an advance was taken).
  if (total <= 0) {
    if (paid > 0) return <Chip size="small" label={t("c_paid")} color="success" />;
    return <Chip size="small" variant="outlined" label={t("pay_no_fee")} />;
  }
  if (paid <= 0) return <Chip size="small" label={t("c_due")} color="error" />;
  if (paid >= total) return <Chip size="small" label={t("c_paid")} color="success" />;
  return <Chip size="small" label={t("c_partial")} color="warning" />;
}

export default function PaymentsClient({
  classes,
  className: classNameProp,
  classId: classIdProp,
  year: yearProp,
  month: monthProp,
  template: templateProp,
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
  const pathname = usePathname();
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  // Class / month / year are LOCAL state now: changing them fetches the new grid
  // in place via a server action (no router.push / no page reload).
  const [classId, setClassId] = useState(classIdProp);
  const [year, setYear] = useState(yearProp);
  const [month, setMonth] = useState(monthProp);
  const [className, setClassName] = useState(classNameProp);
  const [template, setTemplate] = useState<PayColumn[]>(templateProp);
  const [loadingData, startLoad] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => flatten(initialRows, templateProp));
  // Per-student custom fee lines live outside the grid row so the DataGrid row
  // shape stays flat/serialisable; keyed by studentId.
  const [extrasById, setExtrasById] = useState<Record<string, PayExtra[]>>(() =>
    extrasFromRows(initialRows)
  );
  // Opt-in SMS toggle for "Save all" — default OFF so a routine save never texts.
  const [sendSms, setSendSms] = useState(false);
  const [mobileQ, setMobileQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const extrasOf = useCallback((id: string) => extrasById[id] ?? [], [extrasById]);
  const addExtra = (id: string) =>
    setExtrasById((m) => ({ ...m, [id]: [...(m[id] ?? []), { label: "", amount: 0 }] }));
  const updateExtra = (id: string, idx: number, patch: Partial<PayExtra>) =>
    setExtrasById((m) => ({
      ...m,
      [id]: (m[id] ?? []).map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  const removeExtra = (id: string, idx: number) =>
    setExtrasById((m) => ({ ...m, [id]: (m[id] ?? []).filter((_, i) => i !== idx) }));

  // Deferred query keeps the input responsive while the (possibly large) grid /
  // card list re-render is deprioritised — typing never blocks.
  const deferredQ = useDeferredValue(mobileQ);
  const isSearching = mobileQ.trim() !== deferredQ.trim();

  // Lowercased search haystack per row, rebuilt only when the row set changes —
  // never on each keystroke. Searchable by name, roll and phone.
  const searchIndex = useMemo(
    () => rows.map((r) => ({ row: r, hay: `${r.name} ${r.roll} ${r.phone}`.toLowerCase() })),
    [rows]
  );

  // Instant client-side filter shared by the mobile cards AND the desktop grid —
  // pure client-side, no navigation/reload.
  const filteredRows = useMemo(() => {
    const q = deferredQ.trim().toLowerCase();
    if (!q) return rows;
    return searchIndex.filter((x) => x.hay.includes(q)).map((x) => x.row);
  }, [rows, searchIndex, deferredQ]);

  // Swap class/month/year in place: fetch the new grid via a server action and
  // update state — NO navigation, NO reload. The URL is kept in sync with
  // history.replaceState so refresh/bookmark still work.
  function changeFilter(next: { classId?: string; year?: number; month?: number }) {
    const cId = next.classId ?? classId;
    const y = next.year ?? year;
    const m = next.month ?? month;
    setClassId(cId);
    setYear(y);
    setMonth(m);
    startLoad(async () => {
      try {
        const res = await loadPaymentRows(cId, y, m);
        setTemplate(res.template);
        setClassName(res.className);
        setRows(flatten(res.rows, res.template));
        setExtrasById(extrasFromRows(res.rows));
        setExpanded({});
        setMobileQ("");
        const params = new URLSearchParams({ classId: cId, year: String(y), month: String(m) });
        window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
      } catch {
        toast.error(t("c_something_wrong"));
      }
    });
  }

  const rowTotal = useCallback(
    (row: Row) =>
      template.reduce((sum, c) => sum + (Number(row[c.key]) || 0), 0) +
      extrasOf(row.id).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [template, extrasOf]
  );

  // Live progress summary across the class (for the mobile summary card).
  const summary = rows.reduce(
    (a, r) => {
      const t = rowTotal(r);
      const p = Number(r.paidAmount) || 0;
      a.expected += t;
      a.collected += p;
      if (t <= 0) a.paid += 1; // nothing payable = settled, never counted as due
      else if (p <= 0) a.unpaid += 1;
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
    const base = template.map((c) => ({ type: c.type, label: c.label, amount: Number(row[c.key]) || 0 }));
    // Persist per-student custom fees as "custom" components (amount > 0 only);
    // buildPaymentRows reloads them back into `extras` on the next search.
    const custom = extrasOf(row.id)
      .map((e) => ({ type: "custom", label: e.label.trim() || t("pay_custom_fee"), amount: Number(e.amount) || 0 }))
      .filter((c) => c.amount > 0);
    return [...base, ...custom];
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
        // Reconcile in place (mark saved) — no page refresh. Paid is kept as
        // entered (advances above the month total are allowed and carried over).
        setRows((rs) =>
          rs.map((r) =>
            r.id === row.id
              ? { ...r, paidAmount: Math.max(0, Number(r.paidAmount) || 0), saved: true }
              : r
          )
        );
      } else toast.error(res.error ?? t("c_something_wrong"));
    });
  }

  function saveAll() {
    start(async () => {
      let res: Awaited<ReturnType<typeof savePaymentsBulk>>;
      try {
        res = await savePaymentsBulk(
          rows.map((row) => ({
            studentId: row.id,
            classId,
            year,
            month,
            components: buildComponents(row),
            paidAmount: Number(row.paidAmount) || 0,
            remarks: String(row.remarks ?? ""),
          })),
          { sendSms }
        );
      } catch {
        // Network / server error — nothing was reported saved; keep edits to retry.
        toast.error(t("c_something_wrong"));
        return;
      }
      if (res.ok) {
        // Reconcile locally (mark saved) rather than a full page re-fetch — the
        // client already holds exactly what was persisted, so the save feels
        // instant. Paid is kept as entered (advances above the total are allowed).
        setRows((rs) =>
          rs.map((r) => ({
            ...r,
            paidAmount: Math.max(0, Number(r.paidAmount) || 0),
            saved: true,
          }))
        );
        toast.success(`${toBnDigits(res.saved)} ${t("pay_saved_n")}`);
      } else {
        toast.error(`${toBnDigits(res.saved)} ${t("pay_saved_n")} · ${toBnDigits(res.failed)} ${t("pay_failed_n")}`);
      }
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
      lines: [
        ...template.map((c) => ({ label: c.label, amount: Number(row[c.key]) || 0 })),
        ...extrasOf(row.id)
          .filter((e) => (Number(e.amount) || 0) > 0)
          .map((e) => ({ label: e.label.trim() || t("pay_custom_fee"), amount: Number(e.amount) || 0 })),
      ],
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
              disabled={loadingData}
              onChange={(e) => changeFilter({ classId: e.target.value })}
              sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField select label={t("c_month")} value={month} disabled={loadingData} onChange={(e) => changeFilter({ month: Number(e.target.value) })}>
              {BN_MONTHS.map((m, i) => (
                <MenuItem key={i} value={i + 1}>{m}</MenuItem>
              ))}
            </TextField>
            <TextField select label={t("c_year")} value={year} disabled={loadingData} onChange={(e) => changeFilter({ year: Number(e.target.value) })}>
              {yearOptions().map((y) => (
                <MenuItem key={y} value={y}>{toBnDigits(y)}</MenuItem>
              ))}
            </TextField>
          </Box>
          {loadingData && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
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
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: mobileQ ? (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end" aria-label="clear search" onClick={() => setMobileQ("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            {mobileQ.trim() && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, ml: 0.5 }}>
                {toBnDigits(filteredRows.length)} {t("students_word")}
              </Typography>
            )}

            <Stack spacing={1.5} sx={{ opacity: isSearching ? 0.6 : 1, transition: "opacity .15s" }}>
            {filteredRows.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>{t("pay_no_match")}</Box>
            ) : filteredRows.map((row) => {
              const total = rowTotal(row);
              const paid = Number(row.paidAmount) || 0;
              const isFull = total > 0 && paid >= total;
              const due = Math.max(0, total - paid);
              const advance = Math.max(0, paid - total); // overpayment carried to other months
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
                        advance > 0
                          ? {
                              l: t("pay_advance"),
                              v: taka(advance),
                              c: "info.main",
                              bg: "rgba(2,132,199,0.10)",
                              bd: "rgba(2,132,199,0.25)",
                            }
                          : {
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
                        {/* Per-student custom fee lines (name + amount, removable). */}
                        {extrasOf(row.id).map((ex, idx) => (
                          <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 0.75 }}>
                            <TextField
                              size="small"
                              placeholder={t("pay_fee_name")}
                              value={ex.label}
                              onChange={(e) => updateExtra(row.id, idx, { label: e.target.value })}
                              sx={{ flex: 1, minWidth: 0 }}
                            />
                            <TextField
                              type="number"
                              size="small"
                              value={Number(ex.amount) || 0}
                              onChange={(e) => updateExtra(row.id, idx, { amount: Math.max(0, Number(e.target.value)) })}
                              inputProps={{ inputMode: "numeric", min: 0, style: { textAlign: "right" } }}
                              InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }}
                              sx={{ width: 118, flexShrink: 0 }}
                            />
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={t("pay_remove_fee")}
                              onClick={() => removeExtra(row.id, idx)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        fullWidth
                        size="small"
                        variant="text"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => addExtra(row.id)}
                        sx={{ justifyContent: "flex-start", mb: 1.25 }}
                      >
                        {t("pay_add_fee")}
                      </Button>
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
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
              <TextField
                size="small"
                placeholder={t("pay_search")}
                value={mobileQ}
                onChange={(e) => setMobileQ(e.target.value)}
                sx={{ maxWidth: 420, flex: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                  endAdornment: mobileQ ? (
                    <InputAdornment position="end">
                      <IconButton size="small" edge="end" aria-label="clear search" onClick={() => setMobileQ("")}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              {mobileQ.trim() && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {toBnDigits(filteredRows.length)} {t("students_word")}
                </Typography>
              )}
            </Stack>
            <Box sx={{ width: "100%", overflowX: "auto", opacity: isSearching ? 0.6 : 1, transition: "opacity .15s" }}>
              <Box sx={{ minWidth: 720 }}>
                <DataGrid
                  autoHeight
                  rows={filteredRows}
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
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {/* Opt-in SMS toggle sits above the save action (default: unchecked). */}
            <FormControlLabel
              control={<Checkbox size="small" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />}
              label={
                <Typography variant="body2">
                  {t("pay_send_sms")}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    {t("pay_send_sms_hint")}
                  </Typography>
                </Typography>
              }
              sx={{ mb: 0.5, mr: 0 }}
            />
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
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
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );
}
