"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
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
import { useI18n } from "@/components/providers/I18nProvider";
import { createTenant, setTenantActive, updateTenant } from "@/app/superadmin/actions";
import type { TenantRow } from "@/lib/superadmin/queries";
import { toBnDigits } from "@/lib/format";
import { tenantSiteLabel, tenantSiteUrl } from "@/lib/tenant/paths";

export default function TenantsClient({
  tenants,
  rootDomain,
  canManage = false,
}: {
  tenants: TenantRow[];
  rootDomain: string;
  canManage?: boolean;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = useMemo<GridColDef<TenantRow>[]>(
    () => [
      { field: "name", headerName: t("sa_center"), flex: 1, minWidth: 150 },
      {
        field: "slug",
        headerName: t("sa_site"),
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
      { field: "adminName", headerName: t("sa_admin"), flex: 1, minWidth: 120 },
      { field: "adminPhone", headerName: t("st_phone"), width: 130 },
      {
        field: "studentCount",
        headerName: t("nav_students"),
        width: 90,
        valueFormatter: (v: number) => toBnDigits(v ?? 0, "en"),
      },
      {
        field: "active",
        headerName: t("c_status"),
        width: 110,
        renderCell: (p) =>
          p.row.active ? (
            <Chip label={t("sa_active")} color="success" size="small" />
          ) : (
            <Chip label={t("sa_inactive")} color="default" size="small" />
          ),
      },
      ...(canManage
        ? [
            {
              field: "actions",
              headerName: t("c_action"),
              width: 130,
              sortable: false,
              filterable: false,
              renderCell: (p) => (
                <>
                  <Tooltip title={t("edit")}>
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
                    {p.row.active ? t("sa_inactive") : t("sa_active")}
                  </Button>
                </>
              ),
            } as GridColDef<TenantRow>,
          ]
        : []),
    ],
    [pending, rootDomain, t, canManage]
  );

  function toggle(row: TenantRow) {
    startTransition(async () => {
      const res = await setTenantActive(row.id, !row.active);
      if (res.ok) toast.success("Updated.");
      else toast.error(res.error ?? "Something went wrong.");
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
        <Typography variant="h6">{t("sa_centers")}</Typography>
        {canManage && (
          <Button startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            {t("sa_new_center")}
          </Button>
        )}
      </Stack>

      {tenants.length === 0 ? (
        <EmptyState
          title={t("sa_no_centers")}
          description={t("sa_no_centers_desc")}
          actionLabel={canManage ? t("sa_new_center") : undefined}
          onAction={canManage ? () => setOpen(true) : undefined}
        />
      ) : (
        <ResponsiveTable
          rows={tenants}
          columns={columns}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          gridMinWidth={780}
          filterText={(row) => `${row.name} ${row.slug} ${row.adminName} ${row.adminPhone}`}
          renderCard={(row) => (
            <DataCard
              title={row.name}
              subtitle={
                <Link href={tenantSiteUrl(row.slug, rootDomain)} target="_blank" rel="noopener">
                  {tenantSiteLabel(row.slug, rootDomain)}
                </Link>
              }
              right={
                row.active ? (
                  <Chip label={t("sa_active")} color="success" size="small" />
                ) : (
                  <Chip label={t("sa_inactive")} size="small" />
                )
              }
              fields={[
                { label: t("sa_admin"), value: row.adminName },
                { label: t("st_phone"), value: row.adminPhone },
                { label: t("nav_students"), value: toBnDigits(row.studentCount ?? 0, "en") },
              ]}
              actions={
                canManage
                  ? [
                      {
                        label: t("edit"),
                        icon: <EditIcon fontSize="small" />,
                        onClick: () => setEditing(row),
                      },
                      row.active
                        ? {
                            label: t("sa_inactive"),
                            icon: <BlockIcon fontSize="small" />,
                            danger: true,
                            onClick: () => toggle(row),
                          }
                        : {
                            label: t("sa_active"),
                            icon: <CheckCircleIcon fontSize="small" />,
                            onClick: () => toggle(row),
                          },
                    ]
                  : []
              }
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
        toast.success("Center updated.");
        onClose();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <ResponsiveDialog
      open={!!tenant}
      onClose={onClose}
      disableClose={pending}
      title="Edit Center"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Center *" value={form.name} onChange={set("name")} />
          <TextField
            label="Site (slug) *"
            value={form.slug}
            onChange={set("slug")}
            InputProps={{ startAdornment: <InputAdornment position="start">{rootDomain}/</InputAdornment> }}
            helperText="The site address will change"
          />
          <TextField label="Admin *" value={form.adminName} onChange={set("adminName")} />
          <TextField
            label="Phone *"
            value={form.phone}
            onChange={set("phone")}
            inputProps={{ inputMode: "tel" }}
          />
          <TextField
            label="New password (optional)"
            type="password"
            value={form.password}
            onChange={set("password")}
            helperText="Leave blank to keep the password unchanged"
            autoComplete="new-password"
          />
        </Stack>
    </ResponsiveDialog>
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
        toast.success("Center created.");
        setForm({ name: "", adminName: "", phone: "", password: "", slug: "" });
        onClose();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      disableClose={pending}
      title="New Center / Admin"
      actions={
        <>
          <Button color="inherit" variant="text" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Center name *" value={form.name} onChange={set("name")} />
          <TextField label="Admin name *" value={form.adminName} onChange={set("adminName")} />
          <TextField
            label="Phone number * (login)"
            value={form.phone}
            onChange={set("phone")}
            inputProps={{ inputMode: "tel" }}
          />
          <TextField
            label="Password *"
            type="password"
            value={form.password}
            onChange={set("password")}
            helperText="At least 6 characters"
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
            helperText="Lowercase letters, digits and hyphen only"
          />
        </Stack>
    </ResponsiveDialog>
  );
}
