"use client";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import { exportToExcel } from "@/lib/excel";
import { printReportTable } from "@/lib/print";
import type { MarketingStudentRow, TenantRow } from "@/lib/superadmin/queries";
import { toBnDigits } from "@/lib/format";

// Super Admin area is English-only.
const num = (v: string | number) => toBnDigits(v, "en");

export default function StudentsMarketingClient({
  rows,
  total,
  tenants,
  query,
  tenantId,
  activeOnly,
}: {
  rows: MarketingStudentRow[];
  total: number;
  tenants: TenantRow[];
  query: string;
  tenantId: string;
  activeOnly: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);
  const [center, setCenter] = useState(tenantId);
  const [active, setActive] = useState(activeOnly);
  const [classFilter, setClassFilter] = useState("");

  // Distinct class names present in the current result set (client-side filter).
  const classNames = useMemo(
    () => [...new Set(rows.map((r) => r.className).filter((c) => c && c !== "—"))].sort(),
    [rows]
  );
  const shown = useMemo(
    () => (classFilter ? rows.filter((r) => r.className === classFilter) : rows),
    [rows, classFilter]
  );

  function applyFilters() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (center) params.set("tenantId", center);
    if (!active) params.set("activeOnly", "0");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function exportRows() {
    exportToExcel(
      "marketing-students.xlsx",
      shown.map((r) => ({
        Center: r.tenantName,
        Name: r.name,
        Roll: r.roll,
        Phone: r.phone,
        Class: r.className,
        Section: r.sectionName,
        Status: r.active ? "Active" : "Inactive",
      })),
      "Students"
    );
  }

  function exportPdf() {
    printReportTable({
      title: "Marketing — Student Data",
      subtitle: `${center ? tenants.find((t) => t.id === center)?.name : "All centers"}${
        classFilter ? " · Class: " + classFilter : ""
      }`,
      meta: [`Total: ${num(shown.length)}`],
      head: ["Center", "Name", "Roll", "Phone", "Class", "Section", "Status"],
      rows: shown.map((r) => [
        r.tenantName,
        r.name,
        num(r.roll),
        r.phone || "—",
        r.className,
        r.sectionName,
        r.active ? "Active" : "Inactive",
      ]),
      numericFrom: 7,
    });
  }

  const columns = useMemo<GridColDef<MarketingStudentRow>[]>(
    () => [
      { field: "tenantName", headerName: "Center", flex: 1, minWidth: 140 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 130 },
      { field: "roll", headerName: "Roll", width: 80 },
      { field: "phone", headerName: "Phone", width: 130 },
      { field: "className", headerName: "Class", width: 110 },
      { field: "sectionName", headerName: "Section", width: 90 },
      {
        field: "active",
        headerName: "Status",
        width: 100,
        renderCell: (p) =>
          p.row.active ? (
            <Chip label="Active" color="success" size="small" />
          ) : (
            <Chip label="Inactive" size="small" />
          ),
      },
    ],
    []
  );

  const truncated = total > rows.length;

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Search and export students across all centers — use for SMS, calls or other marketing.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              label="Search (name, phone, roll)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <TextField
              select
              label="Center"
              value={center}
              onChange={(e) => setCenter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All centers</MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All classes</MenuItem>
              {classNames.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />}
              label="Active only"
            />
            <Button startIcon={<SearchIcon />} onClick={applyFilters} sx={{ alignSelf: "center" }}>
              Search
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1.5 }}
          flexWrap="wrap"
          gap={1}
        >
          <Typography variant="h6">
            Results ({num(shown.length)}
            {truncated ? ` / ${num(total)}` : ""})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<DownloadIcon />} onClick={exportRows} disabled={shown.length === 0} variant="outlined">
              Excel
            </Button>
            <Button startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={shown.length === 0} variant="outlined">
              PDF
            </Button>
          </Stack>
        </Stack>

        {shown.length === 0 ? (
          <EmptyState
            title="No students found"
            description="Try a different keyword, center or class."
          />
        ) : (
          <ResponsiveTable
            rows={shown}
            columns={columns}
            gridMinWidth={780}
            filterText={(r) => `${r.name} ${r.roll} ${r.phone} ${r.className} ${r.tenantName}`}
            renderCard={(r) => (
              <DataCard
                title={r.name}
                subtitle={`${r.tenantName} · ${r.className} ${r.sectionName}`}
                right={
                  r.active ? (
                    <Chip label="Active" color="success" size="small" />
                  ) : (
                    <Chip label="Inactive" size="small" />
                  )
                }
                fields={[
                  { label: "Roll", value: num(r.roll) },
                  { label: "Phone", value: r.phone || "—" },
                ]}
              />
            )}
          />
        )}
        {truncated && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Showing the first {num(rows.length)}. Use a more specific filter.
          </Typography>
        )}
      </Card>
    </Stack>
  );
}
