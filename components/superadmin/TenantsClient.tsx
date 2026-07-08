"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useToast } from "@/components/providers/ToastProvider";
import { createTenant, setTenantActive, updateTenant } from "@/app/superadmin/actions";
import type { TenantRow } from "@/lib/superadmin/queries";
import { toBnDigits } from "@/lib/format";
import { tenantSiteLabel, tenantSiteUrl } from "@/lib/tenant/paths";

export default function TenantsClient({
  tenants,
  rootDomain,
}: {
  tenants: TenantRow[];
  rootDomain: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = useMemo<GridColDef<TenantRow>[]>(
    () => [
      { field: "name", headerName: "সেন্টার", flex: 1, minWidth: 150 },
      {
        field: "slug",
        headerName: "সাইট",
        flex: 1,
        minWidth: 220,
        renderCell: (p) => (
          <Link
            href={tenantSiteUrl(p.row.slug, rootDomain)}
            target="_blank"
            rel="noopener"
          >
            {tenantSiteLabel(p.row.slug, rootDomain)}
          </Link>
        ),
      },
      { field: "adminName", headerName: "অ্যাডমিন", flex: 1, minWidth: 120 },
      { field: "adminPhone", headerName: "ফোন", width: 130 },
      {
        field: "studentCount",
        headerName: "শিক্ষার্থী",
        width: 90,
        valueFormatter: (v: number) => toBnDigits(v ?? 0),
      },
      {
        field: "active",
        headerName: "অবস্থা",
        width: 110,
        renderCell: (p) =>
          p.row.active ? (
            <Chip label="সক্রিয়" color="success" size="small" />
          ) : (
            <Chip label="নিষ্ক্রিয়" color="default" size="small" />
          ),
      },
      {
        field: "actions",
        headerName: "অ্যাকশন",
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <>
            <Tooltip title="সম্পাদনা">
              <IconButton size="small" onClick={() => setEditing(p.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              color={p.row.active ? "error" : "success"}
              variant="outlined"
              disabled={pending}
              onClick={() => toggle(p.row)}
            >
              {p.row.active ? "নিষ্ক্রিয়" : "সক্রিয়"}
            </Button>
          </>
        ),
      },
    ],
    [pending, rootDomain]
  );

  function toggle(row: TenantRow) {
    startTransition(async () => {
      const res = await setTenantActive(row.id, !row.active);
      if (res.ok) toast.success("আপডেট হয়েছে।");
      else toast.error(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6">সেন্টার সমূহ</Typography>
        <Button startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          নতুন সেন্টার
        </Button>
      </Stack>

      {tenants.length === 0 ? (
        <EmptyState
          title="কোনো সেন্টার নেই"
          description="নতুন সেন্টার ও তার অ্যাডমিন তৈরি করুন।"
          actionLabel="নতুন সেন্টার যোগ করুন"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ResponsiveTable
          rows={tenants}
          columns={columns}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          gridMinWidth={780}
          filterText={(t) => `${t.name} ${t.slug} ${t.adminName} ${t.adminPhone}`}
          renderCard={(t) => (
            <DataCard
              title={t.name}
              subtitle={
                <Link href={tenantSiteUrl(t.slug, rootDomain)} target="_blank" rel="noopener">
                  {tenantSiteLabel(t.slug, rootDomain)}
                </Link>
              }
              right={
                t.active ? (
                  <Chip label="সক্রিয়" color="success" size="small" />
                ) : (
                  <Chip label="নিষ্ক্রিয়" size="small" />
                )
              }
              fields={[
                { label: "অ্যাডমিন", value: t.adminName },
                { label: "ফোন", value: t.adminPhone },
                { label: "শিক্ষার্থী", value: toBnDigits(t.studentCount ?? 0) },
              ]}
              actions={[
                {
                  label: "সম্পাদনা",
                  icon: <EditIcon fontSize="small" />,
                  onClick: () => setEditing(t),
                },
                t.active
                  ? {
                      label: "নিষ্ক্রিয় করুন",
                      icon: <BlockIcon fontSize="small" />,
                      danger: true,
                      onClick: () => toggle(t),
                    }
                  : {
                      label: "সক্রিয় করুন",
                      icon: <CheckCircleIcon fontSize="small" />,
                      onClick: () => toggle(t),
                    },
              ]}
            />
          )}
        />
      )}

      <CreateTenantDialog
        open={open}
        onClose={() => setOpen(false)}
        rootDomain={rootDomain}
      />
      <EditTenantDialog
        tenant={editing}
        onClose={() => setEditing(null)}
        rootDomain={rootDomain}
      />
    </Card>
  );
}

function EditTenantDialog({
  tenant,
  onClose,
  rootDomain,
}: {
  tenant: TenantRow | null;
  onClose: () => void;
  rootDomain: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", adminName: "", phone: "", password: "" });

  // Load the selected tenant's values whenever the dialog opens.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (tenant && tenant.id !== loadedId) {
    setLoadedId(tenant.id);
    setError(null);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      adminName: tenant.adminName,
      phone: tenant.adminPhone,
      password: "",
    });
  }
  if (!tenant && loadedId !== null) setLoadedId(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    if (!tenant) return;
    setError(null);
    start(async () => {
      const res = await updateTenant(tenant.id, form);
      if (res.ok) {
        toast.success("সেন্টার আপডেট হয়েছে।");
        onClose();
      } else setError(res.error ?? "সমস্যা হয়েছে।");
    });
  }

  return (
    <Dialog open={!!tenant} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>সেন্টার সম্পাদনা</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="সেন্টার *" value={form.name} onChange={set("name")} />
          <TextField
            label="সাইট (slug) *"
            value={form.slug}
            onChange={set("slug")}
            InputProps={{ startAdornment: <InputAdornment position="start">{rootDomain}/</InputAdornment> }}
            helperText="সাইটের ঠিকানা পরিবর্তন হবে"
          />
          <TextField label="অ্যাডমিন *" value={form.adminName} onChange={set("adminName")} />
          <TextField
            label="ফোন *"
            value={form.phone}
            onChange={set("phone")}
            inputProps={{ inputMode: "tel" }}
          />
          <TextField
            label="নতুন পাসওয়ার্ড (ঐচ্ছিক)"
            type="password"
            value={form.password}
            onChange={set("password")}
            helperText="খালি রাখলে পাসওয়ার্ড অপরিবর্তিত থাকবে"
            autoComplete="new-password"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
          বাতিল
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "সংরক্ষণ..." : "সংরক্ষণ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateTenantDialog({
  open,
  onClose,
  rootDomain,
}: {
  open: boolean;
  onClose: () => void;
  rootDomain: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    adminName: "",
    phone: "",
    password: "",
    slug: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createTenant(form);
      if (res.ok) {
        toast.success("সেন্টার তৈরি হয়েছে।");
        setForm({ name: "", adminName: "", phone: "", password: "", slug: "" });
        onClose();
      } else {
        setError(res.error ?? "সমস্যা হয়েছে।");
      }
    });
  }

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>নতুন সেন্টার / অ্যাডমিন</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="সেন্টারের নাম *" value={form.name} onChange={set("name")} />
          <TextField label="অ্যাডমিনের নাম *" value={form.adminName} onChange={set("adminName")} />
          <TextField
            label="ফোন নম্বর * (লগইন)"
            value={form.phone}
            onChange={set("phone")}
            inputProps={{ inputMode: "tel" }}
          />
          <TextField
            label="পাসওয়ার্ড *"
            type="password"
            value={form.password}
            onChange={set("password")}
            helperText="কমপক্ষে ৬ অক্ষর"
          />
          <TextField
            label="URL Slug *"
            value={form.slug}
            onChange={set("slug")}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{rootDomain}/</InputAdornment>
              ),
            }}
            helperText="শুধু ছোট হাতের অক্ষর, সংখ্যা ও hyphen"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="inherit" variant="text" onClick={onClose} disabled={pending}>
          বাতিল
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
