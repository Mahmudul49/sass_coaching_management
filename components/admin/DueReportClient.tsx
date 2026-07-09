"use client";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
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
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ClassRow, DueRow } from "@/lib/admin/queries";
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
  classId,
  from,
  to,
  status,
  rows,
  centerName,
}: {
  classes: ClassRow[];
  classId: string;
  from: string;
  to: string;
  status: string;
  rows: DueRow[];
  centerName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "matrix">("list");

  function navigate(next: { classId?: string; from?: string; to?: string; status?: string }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? classId);
    params.set("from", next.from ?? from);
    params.set("to", next.to ?? to);
    params.set("status", next.status ?? status);
    router.push(`${pathname}?${params.toString()}`);
  }

  const totalDue = useMemo(() => rows.reduce((s, r) => s + r.due, 0), [rows]);
  const totalPaid = useMemo(() => rows.reduce((s, r) => s + r.paid, 0), [rows]);

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

  // Build a DBBL "Tuition Fee Collection"-style sheet: a meta header block,
  // then a table with one column per fee component and a TOTAL column.
  function downloadExcel() {
    // Union of all fee-component labels across the filtered rows.
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
              onChange={(e) => navigate({ from: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              type="date"
              label={t("r_to")}
              value={to}
              onChange={(e) => navigate({ to: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              select
              label={t("c_class")}
              value={classId}
              onChange={(e) => navigate({ classId: e.target.value })}
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
              onChange={(e) => navigate({ status: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">{t("r_all")}</MenuItem>
              <MenuItem value="paid">{t("c_paid")}</MenuItem>
              <MenuItem value="partial">{t("c_partial")}</MenuItem>
              <MenuItem value="unpaid">{t("r_unpaid")}</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ sm: "center" }}>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)}>
          <ToggleButton value="list">{t("r_view_list")}</ToggleButton>
          <ToggleButton value="matrix">{t("r_view_matrix")}</ToggleButton>
        </ToggleButtonGroup>
        <Chip color="error" sx={{ fontSize: 15, py: 2.2, px: 1, fontWeight: 700 }} label={`${t("r_total_due")}: ${taka(totalDue)}`} />
        <Chip color="success" sx={{ fontSize: 15, py: 2.2, px: 1, fontWeight: 700 }} label={`${t("r_total_collected")}: ${taka(totalPaid)}`} />
        <Box sx={{ flex: 1 }} />
        {view === "list" && (
          <Button startIcon={<DownloadIcon />} onClick={downloadExcel} disabled={rows.length === 0} sx={{ width: { xs: "100%", sm: "auto" } }}>
            {t("r_excel_download")}
          </Button>
        )}
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        {view === "matrix" ? (
          <PaymentMatrix rows={rows} centerName={centerName} />
        ) : rows.length === 0 ? (
          <EmptyState title={t("r_no_records")} description={t("r_no_records_desc")} />
        ) : (
          <ResponsiveTable
            rows={rows}
            columns={columns}
            renderCard={renderCard}
            filterText={(r) => `${r.name} ${r.roll} ${r.className} ${r.sectionName} ${r.period}`}
            gridMinWidth={900}
          />
        )}
      </Card>
    </Stack>
  );
}
