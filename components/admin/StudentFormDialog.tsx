"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { createStudent, updateStudent } from "@/app/[tenant]/admin/actions/students";
import type { ClassRow, SectionRow, StudentRow } from "@/lib/admin/queries";

export default function StudentFormDialog({
  open,
  onClose,
  classes,
  sections,
  student,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassRow[];
  sections: SectionRow[];
  student?: StudentRow | null;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    classId: "",
    sectionId: "",
    name: "",
    roll: "",
    phone: "",
  });

  useEffect(() => {
    if (open) {
      setError(null);
      setForm({
        classId: student?.classId ?? "",
        sectionId: student?.sectionId ?? "",
        name: student?.name ?? "",
        roll: student?.roll ?? "",
        phone: student?.phone ?? "",
      });
    }
  }, [open, student]);

  const sectionsForClass = useMemo(
    () => sections.filter((s) => s.classId === form.classId),
    [sections, form.classId]
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.value,
      ...(k === "classId" ? { sectionId: "" } : {}),
    }));

  function submit() {
    setError(null);
    start(async () => {
      const res = student
        ? await updateStudent(student.id, form)
        : await createStudent(form);
      if (res.ok) {
        toast.success(student ? "শিক্ষার্থী আপডেট হয়েছে।" : "শিক্ষার্থী যোগ হয়েছে।");
        onClose();
      } else {
        setError(res.error ?? "সমস্যা হয়েছে।");
      }
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      disableClose={pending}
      title={student ? "শিক্ষার্থী সম্পাদনা" : "নতুন শিক্ষার্থী"}
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
            বাতিল
          </Button>
          <Button onClick={submit} disabled={pending} size="large">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField select label="ক্লাস *" value={form.classId} onChange={set("classId")}>
          {classes.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="শাখা (ঐচ্ছিক)"
          value={form.sectionId}
          onChange={set("sectionId")}
          disabled={!form.classId}
          helperText={!form.classId ? "আগে ক্লাস নির্বাচন করুন" : "শাখা না থাকলে খালি রাখুন"}
        >
          <MenuItem value="">
            <em>শাখা নেই</em>
          </MenuItem>
          {sectionsForClass.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="নাম *" value={form.name} onChange={set("name")} />
        <TextField
          label="রোল *"
          value={form.roll}
          onChange={set("roll")}
          inputProps={{ inputMode: "numeric" }}
        />
        <TextField
          label="ফোন নম্বর *"
          type="tel"
          value={form.phone}
          onChange={set("phone")}
          inputProps={{ inputMode: "tel" }}
        />
      </Stack>
    </ResponsiveDialog>
  );
}
