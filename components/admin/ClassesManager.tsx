"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { createClass, updateClass, deleteClass } from "@/app/[tenant]/admin/actions/master";
import type { ClassRow } from "@/lib/admin/queries";
import { toBnDigits } from "@/lib/format";

export default function ClassesManager({ classes }: { classes: ClassRow[] }) {
  const toast = useToast();
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
        toast.success(editing ? "ক্লাস আপডেট হয়েছে।" : "ক্লাস যোগ হয়েছে।");
        setOpen(false);
      } else setError(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteClass(toDelete.id);
      if (res.ok) toast.success("ক্লাস মুছে ফেলা হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
      setToDelete(null);
    });
  }

  const columns = useMemo<GridColDef<ClassRow>[]>(
    () => [
      {
        field: "order",
        headerName: "ক্রম",
        width: 90,
        valueFormatter: (v: number) => toBnDigits(v ?? 0),
      },
      { field: "name", headerName: "ক্লাসের নাম", flex: 1, minWidth: 160 },
      {
        field: "actions",
        headerName: "অ্যাকশন",
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
    []
  );

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">ক্লাস</Typography>
        <Button startIcon={<AddIcon />} onClick={openCreate}>
          নতুন ক্লাস
        </Button>
      </Stack>

      {classes.length === 0 ? (
        <EmptyState
          title="কোনো ক্লাস নেই"
          description="প্রথমে একটি ক্লাস যোগ করুন (যেমন: ষষ্ঠ শ্রেণি)।"
          actionLabel="নতুন ক্লাস যোগ করুন"
          onAction={openCreate}
        />
      ) : (
        <Box sx={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={classes}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter={classes.length <= 100}
            sx={{ border: 0 }}
          />
        </Box>
      )}

      <Dialog open={open} onClose={pending ? undefined : () => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "ক্লাস সম্পাদনা" : "নতুন ক্লাস"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="ক্লাসের নাম *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <TextField
              label="ক্রম"
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              helperText="কম সংখ্যা আগে দেখাবে"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="text" color="inherit" onClick={() => setOpen(false)} disabled={pending}>
            বাতিল
          </Button>
          <Button onClick={submit} disabled={pending}>
            সংরক্ষণ
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        message={`"${toDelete?.name ?? ""}" ক্লাস মুছে ফেলতে চান? এর শাখা ও ফি স্ট্রাকচারও মুছে যাবে।`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
