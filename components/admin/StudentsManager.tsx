"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DataGrid,
  GridToolbarQuickFilter,
  type GridColDef,
} from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StudentFormDialog from "./StudentFormDialog";
import BulkImportDialog from "./BulkImportDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { deleteStudent } from "@/app/[tenant]/admin/actions/students";
import type { ClassRow, SectionRow, StudentRow } from "@/lib/admin/queries";

function Toolbar() {
  return (
    <Box sx={{ p: 1 }}>
      <GridToolbarQuickFilter placeholder="খুঁজুন..." />
    </Box>
  );
}

export default function StudentsManager({
  students,
  classes,
  sections,
  title = "ছাত্র সমূহ",
}: {
  students: StudentRow[];
  classes: ClassRow[];
  sections: SectionRow[];
  title?: string;
}) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [toDelete, setToDelete] = useState<StudentRow | null>(null);
  const [pending, start] = useTransition();

  const noMaster = classes.length === 0 || sections.length === 0;

  const columns = useMemo<GridColDef<StudentRow>[]>(
    () => [
      { field: "roll", headerName: "রোল", width: 90 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 140 },
      { field: "className", headerName: "ক্লাস", width: 120 },
      { field: "sectionName", headerName: "শাখা", width: 100 },
      { field: "phone", headerName: "ফোন", width: 130 },
      {
        field: "actions",
        headerName: "অ্যাকশন",
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <>
            <Tooltip title="সম্পাদনা">
              <IconButton
                size="small"
                onClick={() => {
                  setEditing(p.row);
                  setFormOpen(true);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="মুছুন">
              <IconButton size="small" color="error" onClick={() => setToDelete(p.row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ),
      },
    ],
    []
  );

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteStudent(toDelete.id);
      if (res.ok) toast.success("ছাত্র মুছে ফেলা হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
      setToDelete(null);
    });
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkOpen(true)}
          >
            Excel দিয়ে যোগ
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={noMaster}
          >
            নতুন ছাত্র
          </Button>
        </Stack>
      </Stack>

      {noMaster ? (
        <EmptyState
          title="এখনো কোনো ছাত্র নেই"
          description="Excel দিয়ে যোগ করুন — ক্লাস ও শাখা না থাকলে স্বয়ংক্রিয়ভাবে তৈরি হয়ে যাবে। অথবা আগে ক্লাস ও শাখা যোগ করে ম্যানুয়ালি ছাত্র যোগ করুন।"
          actionLabel="Excel দিয়ে যোগ করুন"
          onAction={() => setBulkOpen(true)}
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="কোনো ছাত্র নেই"
          description="নতুন ছাত্র যোগ করুন অথবা Excel দিয়ে একসাথে যোগ করুন।"
          actionLabel="নতুন ছাত্র যোগ করুন"
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <Box sx={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={students}
            columns={columns}
            disableRowSelectionOnClick
            slots={{ toolbar: Toolbar }}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            sx={{ border: 0 }}
          />
        </Box>
      )}

      <StudentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        classes={classes}
        sections={sections}
        student={editing}
      />
      <BulkImportDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        classes={classes}
        sections={sections}
      />
      <ConfirmDialog
        open={!!toDelete}
        message={`"${toDelete?.name ?? ""}" কে মুছে ফেলতে চান?`}
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
