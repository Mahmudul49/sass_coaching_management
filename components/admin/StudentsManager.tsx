"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
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
import { deleteStudent, setStudentActive } from "@/app/[tenant]/admin/actions/students";
import type { ClassRow, SectionRow, StudentRow } from "@/lib/admin/queries";
import { toBnDigits } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { printReportTable } from "@/lib/print";

export default function StudentsManager({
  students,
  classes,
  sections,
  title = "শিক্ষার্থী সমূহ",
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
  const [view, setView] = useState<"active" | "inactive" | "all">("active");
  const [classFilter, setClassFilter] = useState("");

  const noMaster = classes.length === 0 || sections.length === 0;

  const shown = students.filter(
    (s) =>
      (view === "all" ? true : view === "active" ? s.active : !s.active) &&
      (classFilter ? s.classId === classFilter : true)
  );
  const inactiveCount = students.filter((s) => !s.active).length;

  // Active student count per class (for the per-class summary chips).
  const activeByClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) if (s.active) m.set(s.classId, (m.get(s.classId) ?? 0) + 1);
    return m;
  }, [students]);

  function exportExcel() {
    exportToExcel(
      "students",
      shown.map((s) => ({
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
    const clsLabel = classFilter ? classes.find((c) => c.id === classFilter)?.name : "সব ক্লাস";
    printReportTable({
      title: "শিক্ষার্থী তালিকা",
      subtitle: `ক্লাস: ${clsLabel} · ${view === "active" ? "সক্রিয়" : view === "inactive" ? "নিষ্ক্রিয়" : "সব"}`,
      meta: [`মোট: ${toBnDigits(shown.length)} জন`],
      head: ["রোল", "নাম", "ক্লাস", "শাখা", "ফোন", "অবস্থা"],
      rows: shown.map((s) => [
        toBnDigits(s.roll),
        s.name,
        s.className,
        s.sectionName,
        s.phone || "—",
        s.active ? "সক্রিয়" : "নিষ্ক্রিয়",
      ]),
      numericFrom: 6,
    });
  }

  function toggleActive(row: StudentRow) {
    start(async () => {
      const res = await setStudentActive(row.id, !row.active);
      if (res.ok) toast.success(row.active ? "নিষ্ক্রিয় করা হয়েছে।" : "সক্রিয় করা হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  function openEdit(row: StudentRow) {
    setEditing(row);
    setFormOpen(true);
  }
  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const columns = useMemo<GridColDef<StudentRow>[]>(
    () => [
      { field: "roll", headerName: "রোল", width: 90 },
      { field: "name", headerName: "নাম", flex: 1, minWidth: 140 },
      { field: "className", headerName: "ক্লাস", width: 120 },
      { field: "sectionName", headerName: "শাখা", width: 100 },
      { field: "phone", headerName: "ফোন", width: 130 },
      {
        field: "active",
        headerName: "অবস্থা",
        width: 100,
        renderCell: (p) =>
          p.row.active ? (
            <Chip size="small" color="success" label="সক্রিয়" />
          ) : (
            <Chip size="small" label="নিষ্ক্রিয়" />
          ),
      },
      {
        field: "actions",
        headerName: "অ্যাকশন",
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <>
            <Tooltip title="সম্পাদনা">
              <IconButton size="small" onClick={() => openEdit(p.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={p.row.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}>
              <IconButton
                size="small"
                color={p.row.active ? "warning" : "success"}
                onClick={() => toggleActive(p.row)}
                disabled={pending}
              >
                {p.row.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
    [pending]
  );

  function confirmDelete() {
    if (!toDelete) return;
    start(async () => {
      const res = await deleteStudent(toDelete.id);
      if (res.ok) toast.success("শিক্ষার্থী মুছে ফেলা হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
      setToDelete(null);
    });
  }

  const renderCard = (s: StudentRow) => (
    <DataCard
      title={s.name}
      subtitle={`${s.className} · শাখা ${s.sectionName}`}
      right={
        s.active ? (
          <Chip size="small" color="success" label="সক্রিয়" />
        ) : (
          <Chip size="small" label="নিষ্ক্রিয়" />
        )
      }
      fields={[
        { label: "রোল", value: toBnDigits(s.roll) },
        { label: "ফোন", value: s.phone || "—" },
      ]}
      actions={[
        { label: "সম্পাদনা", icon: <EditIcon fontSize="small" />, onClick: () => openEdit(s) },
        s.active
          ? { label: "নিষ্ক্রিয় করুন", icon: <BlockIcon fontSize="small" />, onClick: () => toggleActive(s) }
          : {
              label: "সক্রিয় করুন",
              icon: <CheckCircleIcon fontSize="small" />,
              onClick: () => toggleActive(s),
            },
        {
          label: "মুছুন",
          icon: <DeleteIcon fontSize="small" />,
          danger: true,
          onClick: () => setToDelete(s),
        },
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
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkOpen(true)}
            sx={{ flex: { xs: 1, sm: "initial" } }}
          >
            Excel ইম্পোর্ট
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={noMaster}
            sx={{ flex: { xs: 1, sm: "initial" } }}
          >
            নতুন শিক্ষার্থী
          </Button>
        </Stack>
      </Stack>

      {noMaster ? (
        <EmptyState
          title="এখনো কোনো শিক্ষার্থী নেই"
          description="Excel দিয়ে যোগ করুন — ক্লাস ও শাখা না থাকলে স্বয়ংক্রিয়ভাবে তৈরি হয়ে যাবে। অথবা আগে ক্লাস ও শাখা যোগ করে ম্যানুয়ালি শিক্ষার্থী যোগ করুন।"
          actionLabel="Excel দিয়ে যোগ করুন"
          onAction={() => setBulkOpen(true)}
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="কোনো শিক্ষার্থী নেই"
          description="নতুন শিক্ষার্থী যোগ করুন অথবা Excel দিয়ে একসাথে যোগ করুন।"
          actionLabel="নতুন শিক্ষার্থী যোগ করুন"
          onAction={openCreate}
        />
      ) : (
        <>
          {/* Per-class active student counts */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            {classes.map((c) => (
              <Chip
                key={c.id}
                size="small"
                variant={classFilter === c.id ? "filled" : "outlined"}
                color={classFilter === c.id ? "primary" : "default"}
                onClick={() => setClassFilter(classFilter === c.id ? "" : c.id)}
                label={`${c.name}: ${toBnDigits(activeByClass.get(c.id) ?? 0)}`}
              />
            ))}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            sx={{ mb: 1.5 }}
            useFlexGap
            flexWrap="wrap"
          >
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)}>
              <ToggleButton value="active">সক্রিয় ({toBnDigits(students.length - inactiveCount)})</ToggleButton>
              <ToggleButton value="inactive">নিষ্ক্রিয় ({toBnDigits(inactiveCount)})</ToggleButton>
              <ToggleButton value="all">সব ({toBnDigits(students.length)})</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              size="small"
              label="ক্লাস"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">সব ক্লাস</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportExcel} disabled={shown.length === 0}>
              Excel
            </Button>
            <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={shown.length === 0}>
              PDF
            </Button>
          </Stack>

          <ResponsiveTable
            rows={shown}
            columns={columns}
            renderCard={renderCard}
            filterText={(s) => `${s.name} ${s.roll} ${s.className} ${s.sectionName} ${s.phone}`}
            gridMinWidth={740}
          />
        </>
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
