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
import { monthName as monthNameFmt, taka as takaFmt, toBnDigits as bnFmt } from "@/lib/format";

type MatrixStudent = {
  studentId: string;
  name: string;
  roll: string;
  className: string;
  sectionName: string;
  cells: Record<string, number>; // ym key -> ACTUAL cash collected that month
  payable: number; // Σ monthly payable (fee structure / override)
  collected: number; // Σ actual cash received
};

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/**
 * Smart status from PAYABLE vs actual COLLECTED (allocation totals):
 *   collected 0 → Due; > payable → Overpayment; == payable → Paid; else Partial.
 */
function statusOf(
  payable: number,
  collected: number,
  t: (k: MessageKey) => string
): { label: string; color: "success" | "warning" | "error" | "info" } {
  if (collected <= 0) return { label: t("c_due"), color: "error" };
  if (collected > payable) return { label: t("mx_overpaid"), color: "info" };
  if (collected >= payable) return { label: t("c_paid"), color: "success" };
  return { label: t("c_partial"), color: "warning" };
}

/**
 * Pivot the (student × month) rows into a matrix: one row per student, one
 * column per month (cell = actual cash collected that month), plus Payable /
 * Paid / Due / % / Status and a totals footer. Overpayment shows as advance.
 */
export default function PaymentMatrix({ rows, centerName }: { rows: DueRow[]; centerName: string }) {
  const { t, locale } = useI18n();
  const en = locale === "en";
  const taka = (n: number) => takaFmt(n, locale);
  const toBnDigits = (v: string | number) => bnFmt(v, locale);
  const monthName = (m: number) => monthNameFmt(m, locale);
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
          collected: 0,
        };
        map.set(r.studentId, s);
      }
      s.cells[key] = (s.cells[key] ?? 0) + r.collected;
      s.payable += r.total;
      s.collected += r.collected;
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

  // Footer totals (over the currently shown students).
  const totals = useMemo(() => {
    const perMonth: Record<string, number> = {};
    let payable = 0;
    let collected = 0;
    for (const s of shown) {
      payable += s.payable;
      collected += s.collected;
      for (const m of months) perMonth[m.key] = (perMonth[m.key] ?? 0) + (s.cells[m.key] ?? 0);
    }
    const due = shown.reduce((sum, s) => sum + Math.max(0, s.payable - s.collected), 0);
    const advance = shown.reduce((sum, s) => sum + Math.max(0, s.collected - s.payable), 0);
    return { perMonth, payable, collected, due, advance };
  }, [shown, months]);

  const dueOf = (s: MatrixStudent) => Math.max(0, s.payable - s.collected);
  const pctOf = (s: MatrixStudent) =>
    s.payable > 0 ? Math.round((Math.min(s.collected, s.payable) / s.payable) * 100) : 0;

  function buildAoa() {
    const header = [
      "NAME",
      "ROLL",
      "CLASS",
      "SECTION",
      ...months.map((m) => `${monthName(m.month)} ${m.year}`),
      "PAYABLE",
      "COLLECTED",
      "DUE",
      "ADVANCE",
      "PERCENT",
      "STATUS",
    ];
    const body = shown.map((s) => [
      s.name,
      s.roll,
      s.className,
      s.sectionName,
      ...months.map((m) => s.cells[m.key] ?? 0),
      s.payable,
      s.collected,
      dueOf(s),
      Math.max(0, s.collected - s.payable),
      `${pctOf(s)}%`,
      statusOf(s.payable, s.collected, t).label,
    ]);
    const totalRow = [
      "TOTAL",
      "",
      "",
      "",
      ...months.map((m) => totals.perMonth[m.key] ?? 0),
      totals.payable,
      totals.collected,
      totals.due,
      totals.advance,
      "",
      "",
    ];
    return [
      ["Payment Matrix"],
      [`Institution : ${centerName}`],
      [],
      header,
      ...body,
      totalRow,
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
      th("%") +
      th(t("c_status"));
    const body = shown
      .map((s) => {
        const cells = months.map((m) => `<td class="r">${taka(s.cells[m.key] ?? 0)}</td>`).join("");
        return `<tr><td>${s.name}</td><td>${toBnDigits(s.roll)}</td><td>${s.className}</td>${cells}<td class="r">${taka(
          s.payable
        )}</td><td class="r">${taka(s.collected)}</td><td class="r">${taka(dueOf(s))}</td><td class="r">${toBnDigits(
          pctOf(s)
        )}%</td><td>${statusOf(s.payable, s.collected, t).label}</td></tr>`;
      })
      .join("");
    const monthTotals = months.map((m) => `<td class="r">${taka(totals.perMonth[m.key] ?? 0)}</td>`).join("");
    const footer = `<tr class="tot"><td>${t("c_total")}</td><td></td><td></td>${monthTotals}<td class="r">${taka(
      totals.payable
    )}</td><td class="r">${taka(totals.collected)}</td><td class="r">${taka(totals.due)}</td><td></td><td></td></tr>`;
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Payment Matrix</title>
      <style>body{font-family:'Hind Siliguri',sans-serif;padding:16px}h2{text-align:center}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:4px 6px}
      th{background:#f0f0f0}.r{text-align:right}.tot td{font-weight:bold;background:#f7f7f7}
      @media print{button{display:none}}</style></head>
      <body><h2>${centerName} — ${en ? "Payment Matrix" : "পেমেন্ট ম্যাট্রিক্স"}</h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body}${footer}</tbody></table>
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          placeholder={t("mx_search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ maxWidth: 280 }}
        />
        <Chip color="error" variant="outlined" sx={{ fontWeight: 700 }} label={`${t("r_total_due")}: ${taka(totals.due)}`} />
        <Chip color="success" variant="outlined" sx={{ fontWeight: 700 }} label={`${t("r_total_collected")}: ${taka(totals.collected)}`} />
        {totals.advance > 0 && (
          <Chip color="info" variant="outlined" sx={{ fontWeight: 700 }} label={`${t("mx_advance")}: ${taka(totals.advance)}`} />
        )}
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
              const due = dueOf(s);
              const st = statusOf(s.payable, s.collected, t);
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
                  <TableCell align="right">{taka(s.collected)}</TableCell>
                  <TableCell align="right" sx={{ color: due > 0 ? "error.main" : undefined }}>
                    {taka(due)}
                  </TableCell>
                  <TableCell align="right">{toBnDigits(pctOf(s))}%</TableCell>
                  <TableCell>
                    <Chip size="small" color={st.color} label={st.label} />
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Totals footer */}
            <TableRow sx={{ "& td": { fontWeight: 800, borderTop: "2px solid", borderColor: "divider" } }}>
              <TableCell>{t("c_total")}</TableCell>
              <TableCell />
              <TableCell />
              {months.map((m) => (
                <TableCell key={m.key} align="right">
                  {taka(totals.perMonth[m.key] ?? 0)}
                </TableCell>
              ))}
              <TableCell align="right">{taka(totals.payable)}</TableCell>
              <TableCell align="right">{taka(totals.collected)}</TableCell>
              <TableCell align="right" sx={{ color: totals.due > 0 ? "error.main" : undefined }}>
                {taka(totals.due)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}
