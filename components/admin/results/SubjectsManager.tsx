"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createSubject, updateSubject, deleteSubject } from "@/app/[tenant]/admin/actions/results";
import type { ClassRow } from "@/lib/admin/queries";
import type { SubjectRow } from "@/lib/results/queries";

/** Subject master data per class — same CRUD pattern as SectionsManager. */
export default function SubjectsManager({
  classes,
  subjects,
}: {
  classes: ClassRow[];
  subjects: SubjectRow[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [toDelete, setToDelete] = useState<SubjectRow | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ classId: "", name: "", order: 0 });

  function openCreate() {
    setEditing(null);
    setForm({ classId: classes[0]?.id ?? "", name: "", order: 0 });
    setError(null);
    setOpen(true);
  }
  function openEdit(row: SubjectRow) {
    setEditing(row);
    setForm({ classId: row.classId, name: row.name, order: row.order });
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = editing
        ? await updateSubject(editing.id, form.name, form.order)
        : await createSubject(form.classId, form.name, form.order);
      if (res.ok) {
        toast.success(editing ? "Subject updated." : "Subject added.");
        setOpen(false);
        router.refresh();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteSubject(toDelete.id);
      if (res.ok) toast.success("Subject deleted.");
      else toast.error(res.error ?? "Something went wrong.");
      setToDelete(null);
      router.refresh();
    });
  }

  const columns = useMemo<GridColDef<SubjectRow>[]>(
    () => [
      { field: "className", headerName: "Class", flex: 1, minWidth: 140 },
      { field: "name", headerName: "Subject", flex: 1, minWidth: 140 },
      { field: "order", headerName: "Order", width: 90, type: "number" },
      {
        field: "actions",
        headerName: "Action",
        width: 110,
        sortable: false,
        filterable: false,
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
    []
  );

  const renderCard = (s: SubjectRow) => (
    <DataCard
      title={`${s.className} — ${s.name}`}
      subtitle="Subject"
      actions={[
        { label: "Edit", icon: <EditIcon fontSize="small" />, onClick: () => openEdit(s) },
        { label: "Delete", icon: <DeleteIcon fontSize="small" />, danger: true, onClick: () => setToDelete(s) },
      ]}
    />
  );

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Subjects</Typography>
        <Button startIcon={<AddIcon />} onClick={openCreate}>
          New subject
        </Button>
      </Stack>

      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          description="Add the subjects for each class to build exams."
          actionLabel="Add subject"
          onAction={openCreate}
        />
      ) : (
        <ResponsiveTable
          rows={subjects}
          columns={columns}
          renderCard={renderCard}
          filterText={(s) => `${s.className} ${s.name}`}
          searchPlaceholder="Search subjects..."
          gridMinWidth={420}
        />
      )}

      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        disableClose={pending}
        title={editing ? "Edit subject" : "New subject"}
        maxWidth="xs"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              Save
            </Button>
          </>
        }
      >
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Class"
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
            label="Subject name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <TextField
            label="Display order"
            type="number"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
            inputProps={{ inputMode: "numeric" }}
          />
        </Stack>
      </ResponsiveDialog>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete subject"
        message={`Delete "${toDelete?.className ?? ""} — ${toDelete?.name ?? ""}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
