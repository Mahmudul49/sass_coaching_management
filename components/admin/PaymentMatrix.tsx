"use client";
import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import EmptyState from "@/components/ui/EmptyState";
import { exportAoa } from "@/lib/excel";
import { useI18n } from "@/components/providers/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { DueRow } from "@/lib/admin/queries";
import { monthName, taka, toBnDigits } from "@/lib/format";

type MatrixStudent = {
  studentId: string;
  name: string;
  roll: string;
  className: string;
  sectionName: string;
  cells: Record<string, number>; // ym key -> paid
  payable: number;
  paid: number;
};

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

function statusOf(
  payable: number,
  paid: number,
  t: (k: MessageKey) => string
): { label: string; color: "success" | "warning" | "error" } {
  const due = payable - paid;
  if (paid <= 0) return { label: t("c_due"), color: "error" };
  if (due <= 0) return { label: t("c_paid"), color: "success" };
  return { label: t("c_partial"), color: "warning" };
}

/**
 * Pivot the (student × month) fee-projection rows into a matrix: one row per
 * student, one column per month in range, cell = amount paid that month, plus
 * Payable / Paid / Due / % / Status. Reuses the report's server-computed rows.
 */
export default function PaymentMatrix({ rows, centerName }: { rows: DueRow[]; centerName: string }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const { months, students } = useMemo(() => {
    const monthSet = new Map<string, { year: number; month: number }>();
    const map = new Map<string, MatrixStudent>();
    for (const r of rows) {
      const key = ymKey(r.year, r.month);
      monthSet.set(key, { year: r.year, month: r.month });
      let s = map.get(r.studentId);
      if (!s) {
        s = {
          studentId: r.studentId,
          name: r.name,
          roll: r.roll,
          className: r.className,
          sectionName: r.sectionName,
          cells: {},
          payable: 0,
          paid: 0,
        };
        map.set(r.studentId, s);
      }
      s.cells[key] = (s.cells[key] ?? 0) + r.paid;
      s.payable += r.total;
      s.paid += r.paid;
    }
    const months = [...monthSet.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.year - b.year || a.month - b.month);
    const students = [...map.values()].sort(
      (a, b) => a.className.localeCompare(b.className) || a.roll.localeCompare(b.roll)
    );
    return { months, students };
  }, [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.name} ${s.roll}`.toLowerCase().includes(q));
  }, [students, search]);

  function buildAoa() {
    const header = [
      "NAME",
      "ROLL",
      "CLASS",
      "SECTION",
      ...months.map((m) => `${monthName(m.month)} ${m.year}`),
      "PAYABLE",
      "PAID",
      "DUE",
      "PERCENT",
      "STATUS",
    ];
    const body = shown.map((s) => {
      const due = Math.max(0, s.payable - s.paid);
      const pct = s.payable > 0 ? Math.round((s.paid / s.payable) * 100) : 0;
      return [
        s.name,
        s.roll,
        s.className,
        s.sectionName,
        ...months.map((m) => s.cells[m.key] ?? 0),
        s.payable,
        s.paid,
        due,
        `${pct}%`,
        statusOf(s.payable, s.paid, t).label,
      ];
    });
    return [
      ["Payment Matrix"],
      [`Institution : ${centerName}`],
      [],
      header,
      ...body,
    ] as (string | number)[][];
  }

  function exportExcel() {
    exportAoa("payment-matrix", buildAoa());
  }

  function printMatrix() {
    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) return;
    const th = (s: string) => `<th>${s}</th>`;
    const head =
      th(t("c_name")) +
      th(t("c_roll")) +
      th(t("c_class")) +
      months.map((m) => th(`${monthName(m.month)}`)).join("") +
      th(t("mx_payable")) +
      th(t("c_paid")) +
      th(t("c_due")) +
      th("%");
    const body = shown
      .map((s) => {
        const due = Math.max(0, s.payable - s.paid);
        const pct = s.payable > 0 ? Math.round((s.paid / s.payable) * 100) : 0;
        const cells = months.map((m) => `<td style="text-align:right">${taka(s.cells[m.key] ?? 0)}</td>`).join("");
        return `<tr><td>${s.name}</td><td>${toBnDigits(s.roll)}</td><td>${s.className}</td>${cells}<td style="text-align:right">${taka(
          s.payable
        )}</td><td style="text-align:right">${taka(s.paid)}</td><td style="text-align:right">${taka(due)}</td><td style="text-align:right">${toBnDigits(
          pct
        )}%</td></tr>`;
      })
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Payment Matrix</title>
      <style>body{font-family:'Hind Siliguri',sans-serif;padding:16px}h2{text-align:center}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:4px 6px}
      th{background:#f0f0f0}@media print{button{display:none}}</style></head>
      <body><h2>${centerName} — পেমেন্ট ম্যাট্রিক্স</h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()">${t("ar_print")}</button></div>
      </body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  if (rows.length === 0) {
    return <EmptyState title={t("mx_no_data")} description={t("mx_no_data_desc")} />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <TextField
          size="small"
          placeholder={t("mx_search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ maxWidth: 280 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportExcel}>
          {t("export_excel")}
        </Button>
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={printMatrix}>
          {t("ar_print")}
        </Button>
      </Stack>

      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 640, "& td, & th": { whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow>
              <TableCell>{t("c_name")}</TableCell>
              <TableCell>{t("c_roll")}</TableCell>
              <TableCell>{t("c_class")}</TableCell>
              {months.map((m) => (
                <TableCell key={m.key} align="right">
                  {monthName(m.month)}
                </TableCell>
              ))}
              <TableCell align="right">{t("mx_payable")}</TableCell>
              <TableCell align="right">{t("c_paid")}</TableCell>
              <TableCell align="right">{t("c_due")}</TableCell>
              <TableCell align="right">%</TableCell>
              <TableCell>{t("c_status")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((s) => {
              const due = Math.max(0, s.payable - s.paid);
              const pct = s.payable > 0 ? Math.round((s.paid / s.payable) * 100) : 0;
              const st = statusOf(s.payable, s.paid, t);
              return (
                <TableRow key={s.studentId} hover>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{toBnDigits(s.roll)}</TableCell>
                  <TableCell>{s.className}</TableCell>
                  {months.map((m) => (
                    <TableCell key={m.key} align="right">
                      {taka(s.cells[m.key] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell align="right">{taka(s.payable)}</TableCell>
                  <TableCell align="right">{taka(s.paid)}</TableCell>
                  <TableCell align="right" sx={{ color: due > 0 ? "error.main" : undefined }}>
                    {taka(due)}
                  </TableCell>
                  <TableCell align="right">{toBnDigits(pct)}%</TableCell>
                  <TableCell>
                    <Chip size="small" color={st.color} label={st.label} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}
