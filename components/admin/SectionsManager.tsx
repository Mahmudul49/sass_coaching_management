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
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
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
        toast.success(editing ? "শাখা আপডেট হয়েছে।" : "শাখা যোগ হয়েছে।");
        setOpen(false);
      } else setError(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteSection(toDelete.id);
      if (res.ok) toast.success("শাখা মুছে ফেলা হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
      setToDelete(null);
    });
  }

  const columns = useMemo<GridColDef<SectionRow>[]>(
    () => [
      { field: "className", headerName: "ক্লাস", flex: 1, minWidth: 140 },
      { field: "name", headerName: "শাখা", flex: 1, minWidth: 120 },
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

  if (classes.length === 0) {
    return (
      <Card sx={{ p: 2 }}>
        <EmptyState
          title="আগে ক্লাস তৈরি করুন"
          description="শাখা যোগ করার আগে অন্তত একটি ক্লাস থাকতে হবে।"
        />
      </Card>
    );
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">শাখা</Typography>
        <Button startIcon={<AddIcon />} onClick={openCreate}>
          নতুন শাখা
        </Button>
      </Stack>

      {sections.length === 0 ? (
        <EmptyState
          title="কোনো শাখা নেই"
          description="প্রতিটি ক্লাসের জন্য শাখা যোগ করুন (যেমন: A, B)।"
          actionLabel="নতুন শাখা যোগ করুন"
          onAction={openCreate}
        />
      ) : (
        <Box sx={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={sections}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter={sections.length <= 100}
            sx={{ border: 0 }}
          />
        </Box>
      )}

      <Dialog open={open} onClose={pending ? undefined : () => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "শাখা সম্পাদনা" : "নতুন শাখা"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="ক্লাস *"
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
              label="শাখার নাম *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
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
        message={`"${toDelete?.className ?? ""} - ${toDelete?.name ?? ""}" শাখা মুছে ফেলতে চান?`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
