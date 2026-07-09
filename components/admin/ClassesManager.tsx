"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
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
import { createClass, updateClass, deleteClass } from "@/app/[tenant]/admin/actions/master";
import type { ClassRow } from "@/lib/admin/queries";
import { toBnDigits } from "@/lib/format";

export default function ClassesManager({ classes }: { classes: ClassRow[] }) {
  const toast = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [toDelete, setToDelete] = useState<ClassRow | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", order: "0" });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", order: String(classes.length) });
    setError(null);
    setOpen(true);
  }
  function openEdit(row: ClassRow) {
    setEditing(row);
    setForm({ name: row.name, order: String(row.order) });
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    start(async () => {
      const order = Number(form.order) || 0;
      const res = editing
        ? await updateClass(editing.id, form.name, order)
        : await createClass(form.name, order);
      if (res.ok) {
        toast.success(editing ? t("cls_updated") : t("cls_added"));
        setOpen(false);
      } else setError(res.error ?? t("c_something_wrong"));
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteClass(toDelete.id);
      if (res.ok) toast.success(t("cls_deleted"));
      else toast.error(res.error ?? t("c_something_wrong"));
      setToDelete(null);
    });
  }

  const columns = useMemo<GridColDef<ClassRow>[]>(
    () => [
      { field: "order", headerName: t("cls_order"), width: 90, valueFormatter: (v: number) => toBnDigits(v ?? 0) },
      { field: "name", headerName: t("nav_classes"), flex: 1, minWidth: 160 },
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

  const renderCard = (c: ClassRow) => (
    <DataCard
      title={c.name}
      subtitle={`${t("cls_order")}: ${toBnDigits(c.order)}`}
      actions={[
        { label: t("edit"), icon: <EditIcon fontSize="small" />, onClick: () => openEdit(c) },
        { label: t("delete"), icon: <DeleteIcon fontSize="small" />, danger: true, onClick: () => setToDelete(c) },
      ]}
    />
  );

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">{t("nav_classes")}</Typography>
        <Button startIcon={<AddIcon />} onClick={openCreate}>
          {t("cls_new")}
        </Button>
      </Stack>

      {classes.length === 0 ? (
        <EmptyState
          title={t("cls_empty_title")}
          description={t("cls_empty_desc")}
          actionLabel={t("cls_empty_action")}
          onAction={openCreate}
        />
      ) : (
        <ResponsiveTable
          rows={classes}
          columns={columns}
          renderCard={renderCard}
          filterText={(c) => c.name}
          gridMinWidth={360}
        />
      )}

      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        disableClose={pending}
        title={editing ? t("cls_edit") : t("cls_new_title")}
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
            label={t("cls_name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <TextField
            label={t("cls_order")}
            type="number"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
            inputProps={{ inputMode: "numeric" }}
            helperText={t("cls_order_help")}
          />
        </Stack>
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!toDelete}
        message={`"${toDelete?.name ?? ""}" ${t("cls_delete_q")}`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
