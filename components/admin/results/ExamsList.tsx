"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import { type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { deleteExam } from "@/app/[tenant]/admin/actions/results";
import type { ExamRow } from "@/lib/results/queries";

/** The exam list on the Results dashboard — status chips, open/edit/delete. */
export default function ExamsList({ base, exams }: { base: string; exams: ExamRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<ExamRow | null>(null);
  const [pending, start] = useTransition();

  const open = (e: ExamRow) =>
    router.push(e.status === "published" ? `${base}/${e.id}` : `${base}/${e.id}/marks`);

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteExam(toDelete.id);
      if (res.ok) toast.success("Exam deleted.");
      else toast.error(res.error ?? "Something went wrong.");
      setToDelete(null);
      router.refresh();
    });
  }

  const statusChip = (s: ExamRow["status"]) =>
    s === "published" ? (
      <Chip size="small" color="success" label="Published" />
    ) : (
      <Chip size="small" color="warning" variant="outlined" label="Draft" />
    );

  const columns = useMemo<GridColDef<ExamRow>[]>(
    () => [
      { field: "name", headerName: "Exam", flex: 1, minWidth: 160 },
      { field: "className", headerName: "Class", width: 120 },
      { field: "examType", headerName: "Type", width: 130 },
      { field: "date", headerName: "Date", width: 120 },
      { field: "subjectCount", headerName: "Subjects", width: 90, type: "number" },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        renderCell: (p: GridRenderCellParams<ExamRow>) => statusChip(p.row.status),
      },
      {
        field: "actions",
        headerName: "Action",
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (p: GridRenderCellParams<ExamRow>) => (
          <>
            <Tooltip title={p.row.status === "published" ? "View results" : "Enter marks"}>
              <IconButton size="small" color="primary" onClick={() => open(p.row)}>
                {p.row.status === "published" ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <EditIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => setToDelete(p.row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renderCard = (e: ExamRow) => (
    <DataCard
      title={e.name}
      subtitle={`${e.className} · ${e.examType}`}
      right={statusChip(e.status)}
      fields={[
        { label: "Date", value: e.date },
        { label: "Subjects", value: e.subjectCount },
      ]}
      onClick={() => open(e)}
      actions={[
        e.status === "draft"
          ? { label: "Enter marks", icon: <EditIcon fontSize="small" />, onClick: () => open(e) }
          : { label: "View results", icon: <VisibilityIcon fontSize="small" />, onClick: () => open(e) },
        { label: "Delete", icon: <DeleteIcon fontSize="small" />, danger: true, onClick: () => setToDelete(e) },
      ]}
    />
  );

  if (exams.length === 0) {
    return (
      <Card sx={{ p: 2 }}>
        <EmptyState
          title="No exams yet"
          description="Create your first exam to start entering marks."
        />
      </Card>
    );
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <ResponsiveTable
        rows={exams}
        columns={columns}
        renderCard={renderCard}
        filterText={(e) => `${e.name} ${e.className} ${e.examType}`}
        searchPlaceholder="Search exams..."
        gridMinWidth={760}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete exam"
        message={`Delete "${toDelete?.name ?? ""}"${
          toDelete?.status === "published" ? " (published)" : ""
        } and all its marks and results? This can't be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Card>
  );
}
