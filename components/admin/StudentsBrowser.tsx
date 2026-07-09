"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import StudentFormDialog from "./StudentFormDialog";
import BulkImportDialog from "./BulkImportDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  deleteStudent,
  setStudentActive,
  loadStudentsPage,
} from "@/app/[tenant]/admin/actions/students";
import type { ClassRow, SectionRow, StudentRow, StudentsPage } from "@/lib/admin/queries";
import { toBnDigits } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { printReportTable } from "@/lib/print";

type View = "active" | "inactive" | "all";

/**
 * Server-side cursor-paginated student browser. Filters (class/view/search) are
 * URL-driven → the server renders the first page; "load more" appends the next
 * cursor page via a server action. Never loads the whole collection.
 */
export default function StudentsBrowser({
  classes,
  sections,
  activeCounts,
  totalActive,
  initial,
  classId,
  view,
  search,
}: {
  classes: ClassRow[];
  sections: SectionRow[];
  activeCounts: Record<string, number>;
  totalActive: number;
  initial: StudentsPage;
  classId: string;
  view: View;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [loadingMore, startMore] = useTransition();

  const noMaster = classes.length === 0 || sections.length === 0;

  const [items, setItems] = useState<StudentRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  // When the server sends a new first page (filter changed / refresh), reset.
  useEffect(() => {
    setItems(initial.rows);
    setCursor(initial.nextCursor);
  }, [initial]);

  const [searchInput, setSearchInput] = useState(search);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [toDelete, setToDelete] = useState<StudentRow | null>(null);

  function navigate(next: Partial<{ classId: string; view: View; q: string }>) {
    const p = new URLSearchParams();
    const cls = next.classId ?? classId;
    const v = next.view ?? view;
    const q = next.q ?? searchInput;
    if (cls) p.set("classId", cls);
    if (v !== "active") p.set("view", v);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function loadMore() {
    if (!cursor) return;
    startMore(async () => {
      const res = await loadStudentsPage(
        { classId: classId || undefined, status: view, search: search || undefined },
        cursor
      );
      setItems((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    });
  }

  function afterMutation() {
    router.refresh(); // re-run server page → useEffect resets the list
  }

  function toggleActive(row: StudentRow) {
    start(async () => {
      const res = await setStudentActive(row.id, !row.active);
      if (res.ok) {
        toast.success(row.active ? t("st_deactivated") : t("st_activated"));
        afterMutation();
      } else toast.error(res.error ?? t("c_something_wrong"));
    });
  }
  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteStudent(toDelete.id);
      if (res.ok) {
        toast.success(t("st_deleted"));
        afterMutation();
      } else toast.error(res.error ?? t("c_something_wrong"));
      setToDelete(null);
    });
  }
  const openEdit = (row: StudentRow) => {
    setEditing(row);
    setFormOpen(true);
  };
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  function exportExcel() {
    exportToExcel(
      "students",
      items.map((s) => ({
        Roll: s.roll,
        Name: s.name,
        Class: s.className,
        Section: s.sectionName,
        Phone: s.phone,
        Status: s.active ? "Active" : "Inactive",
      })),
      "Students"
    );
  }
  function exportPdf() {
    printReportTable({
      title: t("st_title"),
      subtitle: `${t("c_class")}: ${classId ? classes.find((c) => c.id === classId)?.name : t("st_all_classes")}`,
      meta: [`${t("c_total")}: ${toBnDigits(items.length)}`],
      head: [t("c_roll"), t("c_name"), t("c_class"), t("c_section"), t("st_phone"), t("c_status")],
      rows: items.map((s) => [
        toBnDigits(s.roll),
        s.name,
        s.className,
        s.sectionName,
        s.phone || "—",
        s.active ? t("st_active") : t("st_inactive"),
      ]),
      numericFrom: 6,
    });
  }

  const columns = useMemo<GridColDef<StudentRow>[]>(
    () => [
      { field: "roll", headerName: t("c_roll"), width: 90 },
      { field: "name", headerName: t("c_name"), flex: 1, minWidth: 140 },
      { field: "className", headerName: t("c_class"), width: 120 },
      { field: "sectionName", headerName: t("c_section"), width: 100 },
      { field: "phone", headerName: t("st_phone"), width: 130 },
      {
        field: "active",
        headerName: t("c_status"),
        width: 100,
        renderCell: (p) =>
          p.row.active ? (
            <Chip size="small" color="success" label={t("st_active")} />
          ) : (
            <Chip size="small" label={t("st_inactive")} />
          ),
      },
      {
        field: "actions",
        headerName: t("c_action"),
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <>
            <Tooltip title={t("edit")}>
              <IconButton size="small" onClick={() => openEdit(p.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={p.row.active ? t("st_deactivate") : t("st_activate")}>
              <IconButton
                size="small"
                color={p.row.active ? "warning" : "success"}
                onClick={() => toggleActive(p.row)}
                disabled={pending}
              >
                {p.row.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton size="small" color="error" onClick={() => setToDelete(p.row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ),
      },
    ],
    [pending, t]
  );

  const renderCard = (s: StudentRow) => (
    <DataCard
      title={s.name}
      subtitle={`${s.className} · ${t("c_section")} ${s.sectionName}`}
      right={
        s.active ? (
          <Chip size="small" color="success" label={t("st_active")} />
        ) : (
          <Chip size="small" label={t("st_inactive")} />
        )
      }
      fields={[
        { label: t("c_roll"), value: toBnDigits(s.roll) },
        { label: t("st_phone"), value: s.phone || "—" },
      ]}
      actions={[
        { label: t("edit"), icon: <EditIcon fontSize="small" />, onClick: () => openEdit(s) },
        s.active
          ? { label: t("st_deactivate"), icon: <BlockIcon fontSize="small" />, onClick: () => toggleActive(s) }
          : { label: t("st_activate"), icon: <CheckCircleIcon fontSize="small" />, onClick: () => toggleActive(s) },
        { label: t("delete"), icon: <DeleteIcon fontSize="small" />, danger: true, onClick: () => setToDelete(s) },
      ]}
    />
  );

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6">{t("st_title")}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulkOpen(true)} sx={{ flex: { xs: 1, sm: "initial" } }}>
            {t("st_import")}
          </Button>
          <Button startIcon={<AddIcon />} onClick={openCreate} disabled={noMaster} sx={{ flex: { xs: 1, sm: "initial" } }}>
            {t("st_new")}
          </Button>
        </Stack>
      </Stack>

      {noMaster ? (
        <EmptyState
          title={t("st_empty1_title")}
          description={t("st_empty1_desc")}
          actionLabel={t("st_empty1_action")}
          onAction={() => setBulkOpen(true)}
        />
      ) : (
        <>
          {/* Per-class active counts (aggregation, not full scan) */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {classes.map((c) => (
              <Chip
                key={c.id}
                size="small"
                variant={classId === c.id ? "filled" : "outlined"}
                color={classId === c.id ? "primary" : "default"}
                onClick={() => navigate({ classId: classId === c.id ? "" : c.id })}
                label={`${c.name}: ${toBnDigits(activeCounts[c.id] ?? 0)}`}
              />
            ))}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && navigate({ view: v })}>
              <ToggleButton value="active">{t("st_active")} ({toBnDigits(totalActive)})</ToggleButton>
              <ToggleButton value="inactive">{t("st_inactive")}</ToggleButton>
              <ToggleButton value="all">{t("st_all")}</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              size="small"
              label={t("c_class")}
              value={classId}
              onChange={(e) => navigate({ classId: e.target.value })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">{t("st_all_classes")}</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              placeholder={t("search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && navigate({ q: searchInput })}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 180 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportExcel} disabled={items.length === 0}>
              Excel
            </Button>
            <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={items.length === 0}>
              PDF
            </Button>
          </Stack>

          {items.length === 0 ? (
            <EmptyState title={t("st_empty2_title")} description={t("st_empty2_desc")} actionLabel={t("st_new")} onAction={openCreate} />
          ) : (
            <ResponsiveTable rows={items} columns={columns} renderCard={renderCard} gridMinWidth={740} />
          )}

          {cursor && (
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Button variant="outlined" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t("pay_saving") : t("st_load_more")}
              </Button>
            </Box>
          )}
        </>
      )}

      <StudentFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          afterMutation();
        }}
        classes={classes}
        sections={sections}
        student={editing}
      />
      <BulkImportDialog
        open={bulkOpen}
        onClose={() => {
          setBulkOpen(false);
          afterMutation();
        }}
        classes={classes}
        sections={sections}
      />
      <ConfirmDialog
        open={!!toDelete}
        message={`"${toDelete?.name ?? ""}" ${t("st_delete_q")}`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
