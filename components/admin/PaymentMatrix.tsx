"use client";
import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableSortLabel from "@mui/material/TableSortLabel";
import TablePagination from "@mui/material/TablePagination";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaidIcon from "@mui/icons-material/Paid";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SavingsIcon from "@mui/icons-material/Savings";
import StatCard from "@/components/ui/StatCard";
import DataCard from "@/components/ui/DataCard";
import EmptyState from "@/components/ui/EmptyState";
import OrientationToggle, { type Orientation } from "@/components/ui/OrientationToggle";
import { exportAoa } from "@/lib/excel";
import { brandHeader, dataTable, docFooter, openPrintWindow, renderPrintDoc } from "@/lib/print/document";
import type { DueRow } from "@/lib/admin/queries";
import { monthName as monthNameFmt, taka as takaFmt } from "@/lib/format";

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

type StatusKind = "paid" | "partial" | "due" | "advance";
type SortKey = "name" | "roll" | "className" | "payable" | "collected" | "due" | "pct" | "status";

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

const STATUS_META: Record<StatusKind, { label: string; color: "success" | "warning" | "error" | "info" }> = {
  paid: { label: "Paid", color: "success" },
  partial: { label: "Partial", color: "warning" },
  due: { label: "Due", color: "error" },
  advance: { label: "Advance", color: "info" },
};

/** Category from PAYABLE vs actual COLLECTED (allocation totals). */
function statusOf(payable: number, collected: number): StatusKind {
  if (collected <= 0) return payable > 0 ? "due" : "paid";
  if (collected > payable) return "advance";
  if (collected >= payable) return "paid";
  return "partial";
}

/**
 * Pivot the (student × month) rows into a matrix: one row per student, one
 * column per month (cell = actual cash collected that month), plus Payable /
 * Collected / Due / % / Status, summary cards, a totals footer, in-place
 * search + status filter, column sorting, pagination and Excel/PDF export.
 */
export default function PaymentMatrix({ rows, centerName }: { rows: DueRow[]; centerName: string }) {
  const taka = (n: number) => takaFmt(n);
  const monthName = (m: number) => monthNameFmt(m);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StatusKind>("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "className", dir: "asc" });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  // Wide month grid prints best on landscape by default; user can switch.
  const [orientation, setOrientation] = useState<Orientation>("landscape");

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
    const students = [...map.values()];
    return { months, students };
  }, [rows]);

  const dueOf = (s: MatrixStudent) => Math.max(0, s.payable - s.collected);
  const advanceOf = (s: MatrixStudent) => Math.max(0, s.collected - s.payable);
  const pctOf = (s: MatrixStudent) =>
    s.payable > 0 ? Math.round((Math.min(s.collected, s.payable) / s.payable) * 100) : 100;

  // Search + status filter (applies to summary cards, table and export alike).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !`${s.name} ${s.roll} ${s.className} ${s.sectionName}`.toLowerCase().includes(q)) return false;
      if (statusFilter && statusOf(s.payable, s.collected) !== statusFilter) return false;
      return true;
    });
  }, [students, search, statusFilter]);

  // Sorting (stable on the filtered set).
  const sorted = useMemo(() => {
    const val = (s: MatrixStudent): string | number => {
      switch (sort.key) {
        case "name":
          return s.name.toLowerCase();
        case "roll":
          return s.roll;
        case "className":
          return `${s.className} ${s.roll}`.toLowerCase();
        case "payable":
          return s.payable;
        case "collected":
          return s.collected;
        case "due":
          return dueOf(s);
        case "pct":
          return pctOf(s);
        case "status":
          return STATUS_META[statusOf(s.payable, s.collected)].label;
      }
    };
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sort]);

  const paged = useMemo(
    () => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage]
  );

  // Summary + footer totals — over the FILTERED set (not just the current page).
  const totals = useMemo(() => {
    const perMonth: Record<string, number> = {};
    let payable = 0;
    let collected = 0;
    let due = 0;
    let advance = 0;
    for (const s of filtered) {
      payable += s.payable;
      collected += s.collected;
      due += dueOf(s);
      advance += advanceOf(s);
      for (const m of months) perMonth[m.key] = (perMonth[m.key] ?? 0) + (s.cells[m.key] ?? 0);
    }
    return { perMonth, payable, collected, due, advance, count: filtered.length };
  }, [filtered, months]);

  function onSearch(v: string) {
    setSearch(v);
    setPage(0);
  }
  function onStatusFilter(v: "" | StatusKind) {
    setStatusFilter(v);
    setPage(0);
  }
  function onSort(key: SortKey) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(0);
  }

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
    const body = sorted.map((s) => [
      s.name,
      s.roll,
      s.className,
      s.sectionName,
      ...months.map((m) => s.cells[m.key] ?? 0),
      s.payable,
      s.collected,
      dueOf(s),
      advanceOf(s),
      `${pctOf(s)}%`,
      STATUS_META[statusOf(s.payable, s.collected)].label,
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
    return [["Payment Matrix"], [`Institution : ${centerName}`], [], header, ...body, totalRow] as (
      | string
      | number
    )[][];
  }

  function exportExcel() {
    exportAoa("payment-matrix", buildAoa());
  }

  function printMatrix() {
    const head = [
      "Name",
      "Roll",
      "Class",
      ...months.map((m) => monthName(m.month)),
      "Payable",
      "Collected",
      "Due",
      "%",
      "Status",
    ];
    const body = sorted.map((s) => [
      s.name,
      s.roll,
      s.className,
      ...months.map((m) => taka(s.cells[m.key] ?? 0)),
      taka(s.payable),
      taka(s.collected),
      taka(dueOf(s)),
      `${pctOf(s)}%`,
      STATUS_META[statusOf(s.payable, s.collected)].label,
    ]);
    const footer = [
      "Total",
      "",
      "",
      ...months.map((m) => taka(totals.perMonth[m.key] ?? 0)),
      taka(totals.payable),
      taka(totals.collected),
      taka(totals.due),
      "",
      "",
    ];
    const doc = renderPrintDoc({
      title: "Payment Matrix",
      orientation,
      body: `
        ${brandHeader({ centerName, eyebrow: "Finance", subtitle: "Payment Matrix" })}
        ${dataTable({ head, rows: body, numericFrom: 3, footer })}
        ${docFooter(`${totals.count} student${totals.count === 1 ? "" : "s"}`)}
      `,
    });
    openPrintWindow(doc, 1100, 800);
  }

  if (rows.length === 0) {
    return <EmptyState title="No records" description="No data in this date range." />;
  }

  const sortLabel = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <TableCell align={align} sortDirection={sort.key === key ? sort.dir : false}>
      <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : "asc"} onClick={() => onSort(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Stack spacing={2}>
      {/* Summary cards */}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
        }}
      >
        <StatCard label="Students" value={String(totals.count)} icon={<GroupsIcon />} color="secondary.main" />
        <StatCard label="Payable" value={taka(totals.payable)} icon={<AccountBalanceWalletIcon />} color="#0F7A6B" />
        <StatCard label="Collected" value={taka(totals.collected)} icon={<PaidIcon />} color="success.main" />
        <StatCard label="Due" value={taka(totals.due)} icon={<ReportProblemIcon />} color="error.main" />
        <StatCard label="Advance" value={taka(totals.advance)} icon={<SavingsIcon />} color="info.main" />
      </Box>

      {/* Toolbar: search + status filter + export */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search name, roll, class..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ maxWidth: { sm: 280 }, width: "100%" }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value as "" | StatusKind)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
          <MenuItem value="partial">Partial</MenuItem>
          <MenuItem value="due">Due</MenuItem>
          <MenuItem value="advance">Advance</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <OrientationToggle value={orientation} onChange={setOrientation} />
        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportExcel} disabled={totals.count === 0}>
          Excel
        </Button>
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={printMatrix} disabled={totals.count === 0}>
          PDF
        </Button>
      </Stack>

      {totals.count === 0 ? (
        <EmptyState title="No matching students" description="Adjust the search or status filter." />
      ) : (
        <>
          {/* Mobile: per-student cards (month breakdown omitted for width) */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <Stack spacing={1.25}>
              {paged.map((s) => {
                const st = STATUS_META[statusOf(s.payable, s.collected)];
                const due = dueOf(s);
                const adv = advanceOf(s);
                return (
                  <DataCard
                    key={s.studentId}
                    title={s.name}
                    subtitle={`${s.className} ${s.sectionName} · Roll ${s.roll}`}
                    right={<Chip size="small" color={st.color} label={st.label} />}
                    fields={[
                      { label: "Payable", value: taka(s.payable) },
                      { label: "Collected", value: taka(s.collected) },
                      {
                        label: adv > 0 ? "Advance" : "Due",
                        value: (
                          <Box component="span" sx={{ color: due > 0 ? "error.main" : adv > 0 ? "info.main" : "inherit" }}>
                            {taka(adv > 0 ? adv : due)}
                          </Box>
                        ),
                      },
                      { label: "Progress", value: `${pctOf(s)}%` },
                    ]}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Desktop/tablet: full pivot table with month columns */}
          <TableContainer sx={{ display: { xs: "none", md: "block" }, width: "100%", overflowX: "auto" }}>
            <Table size="small" stickyHeader sx={{ minWidth: 720, "& td, & th": { whiteSpace: "nowrap" } }}>
              <TableHead>
                <TableRow>
                  {sortLabel("name", "Name")}
                  {sortLabel("roll", "Roll")}
                  {sortLabel("className", "Class")}
                  {months.map((m) => (
                    <TableCell key={m.key} align="right">
                      {monthName(m.month)}
                    </TableCell>
                  ))}
                  {sortLabel("payable", "Payable", "right")}
                  {sortLabel("collected", "Collected", "right")}
                  {sortLabel("due", "Due", "right")}
                  {sortLabel("pct", "%", "right")}
                  {sortLabel("status", "Status")}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((s) => {
                  const due = dueOf(s);
                  const st = STATUS_META[statusOf(s.payable, s.collected)];
                  return (
                    <TableRow key={s.studentId} hover>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.roll}</TableCell>
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
                      <TableCell align="right">{pctOf(s)}%</TableCell>
                      <TableCell>
                        <Chip size="small" color={st.color} label={st.label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals footer (over the full filtered set) */}
                <TableRow sx={{ "& td": { fontWeight: 800, borderTop: "2px solid", borderColor: "divider" } }}>
                  <TableCell>Total</TableCell>
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
          </TableContainer>

          <TablePagination
            component="div"
            count={totals.count}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </>
      )}
    </Stack>
  );
}
