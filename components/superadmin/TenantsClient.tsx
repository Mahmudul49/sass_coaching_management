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
import AddIcon from "@mui/icons-material/Add";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/providers/ToastProvider";
import { createTenant, setTenantActive } from "@/app/superadmin/actions";
import type { TenantRow } from "@/lib/superadmin/queries";
import { toBnDigits } from "@/lib/format";

export default function TenantsClient({
  tenants,
  rootDomain,
}: {
  tenants: TenantRow[];
  rootDomain: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const protocol = rootDomain.includes("localhost") ? "http" : "https";

  const columns = useMemo<GridColDef<TenantRow>[]>(
    () => [
      { field: "name", headerName: "সেন্টার", flex: 1, minWidth: 150 },
      {
        field: "slug",
        headerName: "সাইট",
        flex: 1,
        minWidth: 180,
        renderCell: (p) => (
          <Link
            href={`${protocol}://${p.row.slug}.${rootDomain}`}
            target="_blank"
            rel="noopener"
          >
            {p.row.slug}.{rootDomain}
          </Link>
        ),
      },
      { field: "adminName", headerName: "অ্যাডমিন", flex: 1, minWidth: 120 },
      { field: "adminPhone", headerName: "ফোন", width: 130 },
      {
        field: "studentCount",
        headerName: "ছাত্র",
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
          <Button
            size="small"
            color={p.row.active ? "error" : "success"}
            variant="outlined"
            disabled={pending}
            onClick={() => toggle(p.row)}
          >
            {p.row.active ? "নিষ্ক্রিয়" : "সক্রিয়"}
          </Button>
        ),
      },
    ],
    [pending, protocol, rootDomain]
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
        <Box sx={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={tenants}
            columns={columns}
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25, 50]}
            sx={{ border: 0 }}
          />
        </Box>
      )}

      <CreateTenantDialog
        open={open}
        onClose={() => setOpen(false)}
        rootDomain={rootDomain}
      />
    </Card>
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
            label="সাবডোমেইন (Slug) *"
            value={form.slug}
            onChange={set("slug")}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">.{rootDomain}</InputAdornment>
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
