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
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import DataCard from "@/components/ui/DataCard";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { createTenant, setTenantActive, updateTenant, cleanCenterData, deleteCenter } from "@/app/superadmin/actions";
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
  const [cleaning, setCleaning] = useState<TenantRow | null>(null);
  const [deleting, setDeleting] = useState<TenantRow | null>(null);
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
              width: 90,
              sortable: false,
              filterable: false,
              renderCell: (p) => (
                <RowMenu
                  active={p.row.active}
                  disabled={pending}
                  onEdit={() => setEditing(p.row)}
                  onToggle={() => toggle(p.row)}
                  onClean={() => setCleaning(p.row)}
                  onDelete={() => setDeleting(p.row)}
                />
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
                      {
                        label: "Clean Data",
                        icon: <CleaningServicesIcon fontSize="small" />,
                        danger: true,
                        onClick: () => setCleaning(row),
                      },
                      {
                        label: "Delete Center",
                        icon: <DeleteForeverIcon fontSize="small" />,
                        danger: true,
                        onClick: () => setDeleting(row),
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
      <CleanDataDialog tenant={cleaning} onClose={() => setCleaning(null)} />
      <DeleteCenterDialog tenant={deleting} onClose={() => setDeleting(null)} />
    </Card>
  );
}

/**
 * Row action menu (desktop grid): Edit · Activate/Deactivate · Clean Data. A
 * single compact ⋮ so no action can ever be clipped by the column width.
 */
function RowMenu({
  active,
  disabled,
  onEdit,
  onToggle,
  onClean,
  onDelete,
}: {
  active: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onClean: () => void;
  onDelete: () => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <Tooltip title="Actions">
        <IconButton size="small" aria-label="row actions" onClick={(e) => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        <MenuItem
          onClick={() => {
            close();
            onEdit();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            close();
            onToggle();
          }}
        >
          <ListItemIcon>
            {active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{active ? "Deactivate" : "Activate"}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            close();
            onClean();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
            <CleaningServicesIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Clean Data</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onDelete();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
            <DeleteForeverIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Center</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * Clean Center Data — a two-stage destructive flow. Stage 1 requires the exact
 * phrase "CLEAN CENTER" and the super-admin's password; stage 2 is the final
 * confirmation. Both the phrase and the password are re-verified on the server.
 */
function CleanDataDialog({ tenant, onClose }: { tenant: TenantRow | null; onClose: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<"form" | "confirm">("form");
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the flow whenever a different center is opened.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (tenant && tenant.id !== loadedId) {
    setLoadedId(tenant.id);
    setStage("form");
    setPhrase("");
    setPassword("");
    setError(null);
  }
  if (!tenant && loadedId !== null) setLoadedId(null);

  const phraseOk = phrase.trim() === "CLEAN CENTER";
  const canContinue = phraseOk && password.length > 0 && !pending;

  function execute() {
    if (!tenant) return;
    setError(null);
    start(async () => {
      const res = await cleanCenterData({ tenantId: tenant.id, confirmText: phrase, password });
      if (res.ok) {
        toast.success(
          `${tenant.name}: removed ${res.total ?? 0} record(s). The admin can log in to a fresh database.`
        );
        onClose();
      } else {
        setError(res.error ?? "Something went wrong.");
        setStage("form");
      }
    });
  }

  return (
    <ResponsiveDialog
      open={!!tenant}
      onClose={onClose}
      disableClose={pending}
      title={stage === "form" ? "Clean Center Data" : "Final confirmation"}
      actions={
        stage === "form" ? (
          <>
            <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button color="error" onClick={() => setStage("confirm")} disabled={!canContinue}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" color="inherit" onClick={() => setStage("form")} disabled={pending}>
              Back
            </Button>
            <Button
              color="error"
              onClick={execute}
              disabled={pending}
              startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
            >
              {pending ? "Cleaning…" : "Permanently delete"}
            </Button>
          </>
        )
      }
    >
      {stage === "form" ? (
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="warning">
            This permanently deletes <b>all operational data</b> for <b>{tenant?.name}</b> — students,
            classes, sections, fees, payments, attendance, messages, SMS logs and related records. The
            center, the admin account, login, roles and profile are <b>preserved</b>, so the admin can
            start with a fresh database. This cannot be undone.
          </Alert>
          <TextField
            label='Type "CLEAN CENTER" to confirm'
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            error={phrase.length > 0 && !phraseOk}
            autoComplete="off"
            slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: "characters" } }}
          />
          <TextField
            label="Your Super Admin password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="error">
            You are about to <b>permanently erase</b> all data for <b>{tenant?.name}</b>. This action is
            irreversible.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Click “Permanently delete” to proceed, or Back to review.
          </Typography>
        </Stack>
      )}
    </ResponsiveDialog>
  );
}

/**
 * Delete Center — permanently removes the tenant ENTIRELY (data + admin users +
 * profile), freeing the slug. Two-stage destructive flow: stage 1 requires the
 * exact phrase "DELETE CENTER" and the super-admin's password; stage 2 is the
 * final confirmation. Both are re-verified on the server.
 */
function DeleteCenterDialog({ tenant, onClose }: { tenant: TenantRow | null; onClose: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<"form" | "confirm">("form");
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset the flow whenever a different center is opened.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (tenant && tenant.id !== loadedId) {
    setLoadedId(tenant.id);
    setStage("form");
    setPhrase("");
    setPassword("");
    setError(null);
  }
  if (!tenant && loadedId !== null) setLoadedId(null);

  const phraseOk = phrase.trim() === "DELETE CENTER";
  const canContinue = phraseOk && password.length > 0 && !pending;

  function execute() {
    if (!tenant) return;
    setError(null);
    start(async () => {
      const res = await deleteCenter({ tenantId: tenant.id, confirmText: phrase, password });
      if (res.ok) {
        toast.success(
          `${tenant.name} deleted — ${res.total ?? 0} record(s) removed. The site address is free again.`
        );
        onClose();
      } else {
        setError(res.error ?? "Something went wrong.");
        setStage("form");
      }
    });
  }

  return (
    <ResponsiveDialog
      open={!!tenant}
      onClose={onClose}
      disableClose={pending}
      title={stage === "form" ? "Delete Center" : "Final confirmation"}
      actions={
        stage === "form" ? (
          <>
            <Button variant="text" color="inherit" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button color="error" onClick={() => setStage("confirm")} disabled={!canContinue}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" color="inherit" onClick={() => setStage("form")} disabled={pending}>
              Back
            </Button>
            <Button
              color="error"
              onClick={execute}
              disabled={pending}
              startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
            >
              {pending ? "Deleting…" : "Permanently delete"}
            </Button>
          </>
        )
      }
    >
      {stage === "form" ? (
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="warning">
            This permanently deletes <b>{tenant?.name}</b> and <b>everything</b> in it — the center
            profile, its admin login, students, classes, sections, fees, payments, attendance, exams,
            results, messages and SMS logs. The site address will become available again. Other centers
            are not affected. This cannot be undone.
          </Alert>
          <TextField
            label='Type "DELETE CENTER" to confirm'
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            error={phrase.length > 0 && !phraseOk}
            autoComplete="off"
            slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: "characters" } }}
          />
          <TextField
            label="Your Super Admin password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="error">
            You are about to <b>permanently delete</b> <b>{tenant?.name}</b> and its admin account. This
            action is irreversible.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Click “Permanently delete” to proceed, or Back to review.
          </Typography>
        </Stack>
      )}
    </ResponsiveDialog>
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
