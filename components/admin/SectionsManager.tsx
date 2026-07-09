"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { createSection, updateSection, deleteSection } from "@/app/[tenant]/admin/actions/master";
import type { ClassRow, SectionRow } from "@/lib/admin/queries";

export default function SectionsManager({
  classes,
  sections,
}: {
  classes: ClassRow[];
  sections: SectionRow[];
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SectionRow | null>(null);
  const [toDelete, setToDelete] = useState<SectionRow | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ classId: "", name: "" });

  function openCreate() {
    setEditing(null);
    setForm({ classId: classes[0]?.id ?? "", name: "" });
    setError(null);
    setOpen(true);
  }
  function openEdit(row: SectionRow) {
    setEditing(row);
    setForm({ classId: row.classId, name: row.name });
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = editing
        ? await updateSection(editing.id, form.name)
        : await createSection(form.classId, form.name);
      if (res.ok) {
        toast.success(editing ? t("sec_updated") : t("sec_added"));
        setOpen(false);
      } else setError(res.error ?? t("c_something_wrong"));
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteSection(toDelete.id);
      if (res.ok) toast.success(t("sec_deleted"));
      else toast.error(res.error ?? t("c_something_wrong"));
      setToDelete(null);
    });
  }

  const columns = useMemo<GridColDef<SectionRow>[]>(
    () => [
      { field: "className", headerName: t("c_class"), flex: 1, minWidth: 140 },
      { field: "name", headerName: t("nav_sections"), flex: 1, minWidth: 120 },
      {
        field: "actions",
        headerName: t("c_action"),
        width: 110,
        sortable: false,
        renderCell: (p) => (
          <>
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setToDelete(p.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </>
        ),
      },
    ],
    [t]
  );

  const renderCard = (s: SectionRow) => (
    <DataCard
      title={`${s.className} — ${s.name}`}
      subtitle={t("nav_sections")}
      actions={[
        { label: t("edit"), icon: <EditIcon fontSize="small" />, onClick: () => openEdit(s) },
        { label: t("delete"), icon: <DeleteIcon fontSize="small" />, danger: true, onClick: () => setToDelete(s) },
      ]}
    />
  );

  if (classes.length === 0) {
    return (
      <Card sx={{ p: 2 }}>
        <EmptyState title={t("sec_need_class")} description={t("sec_need_class_desc")} />
      </Card>
    );
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">{t("nav_sections")}</Typography>
        <Button startIcon={<AddIcon />} onClick={openCreate}>
          {t("sec_new")}
        </Button>
      </Stack>

      {sections.length === 0 ? (
        <EmptyState
          title={t("sec_empty_title")}
          description={t("sec_empty_desc")}
          actionLabel={t("sec_empty_action")}
          onAction={openCreate}
        />
      ) : (
        <ResponsiveTable
          rows={sections}
          columns={columns}
          renderCard={renderCard}
          filterText={(s) => `${s.className} ${s.name}`}
          gridMinWidth={380}
        />
      )}

      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        disableClose={pending}
        title={editing ? t("sec_edit") : t("sec_new_title")}
        maxWidth="xs"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {t("save")}
            </Button>
          </>
        }
      >
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label={t("st_form_class")}
            value={form.classId}
            onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
            disabled={!!editing}
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("sec_name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </Stack>
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!toDelete}
        message={`"${toDelete?.className ?? ""} - ${toDelete?.name ?? ""}" ${t("sec_delete_q")}`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
