"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
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
  const { t } = useI18n();
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
        toast.success(student ? t("st_saved") : t("st_added"));
        onClose();
      } else {
        setError(res.error ?? t("c_something_wrong"));
      }
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      disableClose={pending}
      title={student ? t("st_edit") : t("st_new")}
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={pending} size="large">
            {pending ? t("st_saving") : t("save")}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField select label={t("st_form_class")} value={form.classId} onChange={set("classId")}>
          {classes.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("st_form_section")}
          value={form.sectionId}
          onChange={set("sectionId")}
          disabled={!form.classId}
          helperText={!form.classId ? t("st_pick_class_first") : t("st_section_blank")}
        >
          <MenuItem value="">
            <em>{t("st_no_section")}</em>
          </MenuItem>
          {sectionsForClass.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label={t("st_form_name")} value={form.name} onChange={set("name")} />
        <TextField
          label={t("st_form_roll")}
          value={form.roll}
          onChange={set("roll")}
          inputProps={{ inputMode: "numeric" }}
        />
        <TextField
          label={t("st_form_phone")}
          type="tel"
          value={form.phone}
          onChange={set("phone")}
          inputProps={{ inputMode: "tel" }}
        />
      </Stack>
    </ResponsiveDialog>
  );
}
