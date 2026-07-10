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
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import DownloadIcon from "@mui/icons-material/Download";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import PaymentMatrix from "./PaymentMatrix";
import { exportAoa } from "@/lib/excel";
import { useI18n } from "@/components/providers/I18nProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ClassRow, DueRow, DuePage, DueSummary } from "@/lib/admin/queries";
import { loadDueReport, loadDueReportPage, loadDueReportAll } from "@/app/[tenant]/admin/actions/reports";
import { taka, toBnDigits } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  "": "All",
  paid: "পরিশোধিত (Paid)",
  partial: "আংশিক (Partial)",
  unpaid: "বাকি (Unpaid)",
};

function statusChip(status: DueRow["status"], t: (k: MessageKey) => string) {
  if (status === "paid") return <Chip size="small" color="success" label={t("c_paid")} />;
  if (status === "partial") return <Chip size="small" color="warning" label={t("c_partial")} />;
  return <Chip size="small" color="error" label={t("r_unpaid")} />;
}

export default function DueReportClient({
  classes,
  classId: classIdProp,
  from: fromProp,
  to: toProp,
  status: statusProp,
  initial,
  summary: summaryProp,
  centerName,
}: {
  classes: ClassRow[];
  classId: string;
  from: string;
  to: string;
  status: string;
  initial: DuePage;
  summary: DueSummary;
  centerName: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const toast = useToast();
  const [view, setView] = useState<"list" | "matrix">("list");

  // Filters are LOCAL state now: changing one fetches the new report in place via
  // a server action (no router.push / no page reload). The URL is kept in sync
  // with history.replaceState so refresh/bookmark still work.
  const [classId, setClassId] = useState(classIdProp);
  const [from, setFrom] = useState(fromProp);
  const [to, setTo] = useState(toProp);
  const [status, setStatus] = useState(statusProp);
  const [loadingData, startLoad] = useTransition();

  const filter = useMemo(
    () => ({ classId: classId || undefined, from, to, status }),
    [classId, from, to, status]
  );

  // Paginated list state (first page rendered server-side) + summary totals.
  const [items, setItems] = useState<DueRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [summary, setSummary] = useState<DueSummary>(summaryProp);
  const [loadingMore, startMore] = useTransition();

  // Full set for matrix — fetched lazily, reset when the filter changes.
  const [matrixRows, setMatrixRows] = useState<DueRow[] | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // A fresh server render (e.g. switching back to this tab, or a hard load with
  // URL params) resets all local state back to the server-provided values.
  useEffect(() => {
    setClassId(classIdProp);
    setFrom(fromProp);
    setTo(toProp);
    setStatus(statusProp);
    setItems(initial.rows);
    setCursor(initial.nextCursor);
    setSummary(summaryProp);
    setMatrixRows(null);
    setView("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Apply a filter change in place: fetch the first page + summary via a server
  // action and update state — NO navigation, NO reload.
  function applyFilter(next: { classId?: string; from?: string; to?: string; status?: string }) {
    const cId = next.classId ?? classId;
    const f = next.from ?? from;
    const to_ = next.to ?? to;
    const st = next.status ?? status;
    setClassId(cId);
    setFrom(f);
    setTo(to_);
    setStatus(st);
    startLoad(async () => {
      try {
        const res = await loadDueReport({ classId: cId || undefined, from: f, to: to_, status: st });
        setItems(res.page.rows);
        setCursor(res.page.nextCursor);
        setSummary(res.summary);
        setMatrixRows(null);
        setView("list");
        const params = new URLSearchParams({ tab: "payment", classId: cId, from: f, to: to_, status: st });
        window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
      } catch {
        toast.error(t("c_something_wrong"));
      }
    });
  }

  function loadMore() {
    if (!cursor) return;
    startMore(async () => {
      const res = await loadDueReportPage(filter, cursor);
      setItems((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    });
  }

  async function openMatrix() {
    setView("matrix");
    if (matrixRows) return;
    setMatrixLoading(true);
    try {
      const res = await loadDueReportAll(filter);
      setMatrixRows(res.rows);
      if (res.capped) toast.error(t("r_capped"));
    } finally {
      setMatrixLoading(false);
    }
  }

  const columns = useMemo<GridColDef<DueRow>[]>(
    () => [
      { field: "period", headerName: t("c_month"), width: 130 },
      { field: "roll", headerName: t("c_roll"), width: 80 },
      { field: "name", headerName: t("c_name"), flex: 1, minWidth: 140 },
      { field: "className", headerName: t("c_class"), width: 110 },
      { field: "sectionName", headerName: t("c_section"), width: 80 },
      { field: "total", headerName: t("c_total"), width: 105, valueFormatter: (v: number) => taka(Number(v) || 0) },
      { field: "paid", headerName: t("c_paid"), width: 115, valueFormatter: (v: number) => taka(Number(v) || 0) },
      { field: "due", headerName: t("c_due"), width: 105, valueFormatter: (v: number) => taka(Number(v) || 0) },
      {
        field: "status",
        headerName: t("c_status"),
        width: 110,
        renderCell: (p: GridRenderCellParams<DueRow>) => statusChip(p.row.status, t),
      },
    ],
    [t]
  );

  // Build a DBBL "Tuition Fee Collection"-style sheet from the FULL row set
  // (fetched server-side on demand), a meta header block, then one column per
  // fee component and a TOTAL column.
  async function downloadExcel() {
    setExporting(true);
    try {
      const res = await loadDueReportAll(filter);
      if (res.capped) toast.error(t("r_capped"));
      const rows = res.rows;

      const feeCols: string[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        for (const c of r.components) {
          if (!seen.has(c.label)) {
            seen.add(c.label);
            feeCols.push(c.label);
          }
        }
      }

      const header = [
        "NAME",
        "ROLL",
        "CLASS",
        "SECTION",
        "PHONE",
        "PERIOD",
        ...feeCols,
        "TOTAL",
        "PAID",
        "DUE",
        "STATUS",
      ];

      const dataRows = rows.map((r) => {
        const byLabel = new Map(r.components.map((c) => [c.label, c.amount]));
        return [
          r.name,
          r.roll,
          r.className,
          r.sectionName,
          r.phone,
          `${r.month}/${r.year}`,
          ...feeCols.map((l) => byLabel.get(l) ?? 0),
          r.total,
          r.paid,
          r.due,
          r.status,
        ];
      });

      const aoa: (string | number)[][] = [
        ["Tuition Fee Collection System"],
        [`Institution : ${centerName}`],
        [`From : ${from}`],
        [`To : ${to}`],
        [`Txn Type : ${TYPE_LABEL[status] ?? "All"}`],
        [],
        header,
        ...dataRows,
      ];

      exportAoa(`fee-collection-${from}_to_${to}`, aoa);
    } finally {
      setExporting(false);
    }
  }

  const renderCard = (r: DueRow) => (
    <DataCard
      title={r.name}
      subtitle={`${r.period} · ${r.className} ${r.sectionName} · ${t("c_roll")} ${toBnDigits(r.roll)}`}
      right={statusChip(r.status, t)}
      fields={[
        { label: t("c_total"), value: taka(r.total) },
        { label: t("c_paid"), value: taka(r.paid) },
        {
          label: t("c_due"),
          value: (
            <Box component="span" sx={{ color: r.due > 0 ? "error.main" : "inherit" }}>
              {taka(r.due)}
            </Box>
          ),
        },
      ]}
    />
  );

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap flexWrap="wrap">
            <TextField
              type="date"
              label={t("r_from")}
              value={from}
              disabled={loadingData}
              onChange={(e) => applyFilter({ from: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              type="date"
              label={t("r_to")}
              value={to}
              disabled={loadingData}
              onChange={(e) => applyFilter({ to: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              select
              label={t("c_class")}
              value={classId}
              disabled={loadingData}
              onChange={(e) => applyFilter({ classId: e.target.value })}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">{t("r_all_classes")}</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t("c_status")}
              value={status}
              disabled={loadingData}
              onChange={(e) => applyFilter({ status: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">{t("r_all")}</MenuItem>
              <MenuItem value="paid">{t("c_paid")}</MenuItem>
              <MenuItem value="partial">{t("c_partial")}</MenuItem>
              <MenuItem value="unpaid">{t("r_unpaid")}</MenuItem>
            </TextField>
          </Stack>
          {loadingData && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ sm: "center" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_e, v) => {
            if (!v) return;
            if (v === "matrix") openMatrix();
            else setView("list");
          }}
        >
          <ToggleButton value="list">{t("r_view_list")}</ToggleButton>
          <ToggleButton value="matrix">{t("r_view_matrix")}</ToggleButton>
        </ToggleButtonGroup>
        <Chip color="error" sx={{ fontSize: 15, py: 2.2, px: 1, fontWeight: 700 }} label={`${t("r_total_due")}: ${taka(summary.totalDue)}`} />
        <Chip color="success" sx={{ fontSize: 15, py: 2.2, px: 1, fontWeight: 700 }} label={`${t("r_total_collected")}: ${taka(summary.totalPaid)}`} />
        <Box sx={{ flex: 1 }} />
        {view === "list" && (
          <Button
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={downloadExcel}
            disabled={exporting || summary.count === 0}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {t("r_excel_download")}
          </Button>
        )}
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        {view === "matrix" ? (
          matrixLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : matrixRows && matrixRows.length > 0 ? (
            <PaymentMatrix rows={matrixRows} centerName={centerName} />
          ) : (
            <EmptyState title={t("r_no_records")} description={t("r_no_records_desc")} />
          )
        ) : summary.count === 0 ? (
          <EmptyState title={t("r_no_records")} description={t("r_no_records_desc")} />
        ) : (
          <>
            <ResponsiveTable
              rows={items}
              columns={columns}
              renderCard={renderCard}
              filterText={(r) => `${r.name} ${r.roll} ${r.className} ${r.sectionName} ${r.period}`}
              gridMinWidth={900}
            />
            {cursor && (
              <Box sx={{ textAlign: "center", mt: 2 }}>
                <Button variant="outlined" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t("pay_saving") : t("st_load_more")}
                </Button>
              </Box>
            )}
          </>
        )}
      </Card>
    </Stack>
  );
}
