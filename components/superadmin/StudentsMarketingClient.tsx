"use client";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
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
      title: "মার্কেটিং — শিক্ষার্থী তথ্য",
      subtitle: `${center ? tenants.find((t) => t.id === center)?.name : "সব সেন্টার"}${
        classFilter ? " · ক্লাস: " + classFilter : ""
      }`,
      meta: [`মোট: ${toBnDigits(shown.length)} জন`],
      head: ["সেন্টার", "নাম", "রোল", "ফোন", "ক্লাস", "শাখা", "অবস্থা"],
      rows: shown.map((r) => [
        r.tenantName,
        r.name,
        toBnDigits(r.roll),
        r.phone || "—",
        r.className,
        r.sectionName,
        r.active ? "সক্রিয়" : "নিষ্ক্রিয়",
      ]),
      numericFrom: 7,
    });
  }

  const columns = useMemo<GridColDef<MarketingStudentRow>[]>(
    () => [
      { field: "tenantName", headerName: "সেন্টার", flex: 1, minWidth: 140 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 130 },
      { field: "roll", headerName: "রোল", width: 80 },
      { field: "phone", headerName: "ফোন", width: 130 },
      { field: "className", headerName: "ক্লাস", width: 110 },
      { field: "sectionName", headerName: "শাখা", width: 90 },
      {
        field: "active",
        headerName: "অবস্থা",
        width: 100,
        renderCell: (p) =>
          p.row.active ? (
            <Chip label="সক্রিয়" color="success" size="small" />
          ) : (
            <Chip label="নিষ্ক্রিয়" size="small" />
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
            সকল সেন্টারের শিক্ষার্থীদের তথ্য খুঁজুন ও এক্সপোর্ট করুন — SMS, কল বা অন্য মার্কেটিং
            কাজে ব্যবহার করুন।
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              label="খুঁজুন (নাম, ফোন, রোল)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              sx={{ minWidth: 220, flex: 1 }}
            />
            <TextField
              select
              label="সেন্টার"
              value={center}
              onChange={(e) => setCenter(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">সব সেন্টার</MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="ক্লাস"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">সব ক্লাস</MenuItem>
              {classNames.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />}
              label="শুধু সক্রিয়"
            />
            <Button startIcon={<SearchIcon />} onClick={applyFilters} sx={{ alignSelf: "center" }}>
              খুঁজুন
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
            ফলাফল ({toBnDigits(shown.length)}
            {truncated ? ` / ${toBnDigits(total)}` : ""})
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
            title="কোনো শিক্ষার্থী পাওয়া যায়নি"
            description="অন্য কীওয়ার্ড, সেন্টার বা ক্লাস দিয়ে খুঁজুন।"
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
                    <Chip label="সক্রিয়" color="success" size="small" />
                  ) : (
                    <Chip label="নিষ্ক্রিয়" size="small" />
                  )
                }
                fields={[
                  { label: "রোল", value: toBnDigits(r.roll) },
                  { label: "ফোন", value: r.phone || "—" },
                ]}
              />
            )}
          />
        )}
        {truncated && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            প্রথম {toBnDigits(rows.length)} জন দেখানো হচ্ছে। আরও নির্দিষ্ট ফিল্টার ব্যবহার করুন।
          </Typography>
        )}
      </Card>
    </Stack>
  );
}
