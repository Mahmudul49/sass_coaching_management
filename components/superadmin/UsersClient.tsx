"use client";
import { useMemo, useState, useTransition } from "react";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import KeyIcon from "@mui/icons-material/Key";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { type GridColDef } from "@mui/x-data-grid";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataCard from "@/components/ui/DataCard";
import { useToast } from "@/components/providers/ToastProvider";
import {
  createUser,
  updateUser,
  resetUserPassword,
  setUserActive,
  deleteUser,
} from "@/app/superadmin/users/actions";
import type { PlatformUserRow } from "@/lib/superadmin/queries";

type ConsoleRole = PlatformUserRow["role"];

const ROLE_LABEL: Record<ConsoleRole, string> = {
  superadmin: "SuperAdmin",
  platform_admin: "Admin",
};

function RoleChip({ role }: { role: ConsoleRole }) {
  return (
    <Chip
      label={ROLE_LABEL[role]}
      size="small"
      color={role === "superadmin" ? "primary" : "default"}
      variant={role === "superadmin" ? "filled" : "outlined"}
    />
  );
}

export default function UsersClient({
  users,
  selfId,
}: {
  users: PlatformUserRow[];
  selfId: string;
}) {
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformUserRow | null>(null);
  const [resetting, setResetting] = useState<PlatformUserRow | null>(null);
  const [deleting, setDeleting] = useState<PlatformUserRow | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(row: PlatformUserRow) {
    startTransition(async () => {
      const res = await setUserActive(row.id, !row.active);
      if (res.ok) toast.success("Updated.");
      else toast.error(res.error ?? "Something went wrong.");
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteUser(deleting.id);
      if (res.ok) {
        toast.success("User deleted.");
        setDeleting(null);
      } else toast.error(res.error ?? "Something went wrong.");
    });
  }

  const columns = useMemo<GridColDef<PlatformUserRow>[]>(
    () => [
      { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
      { field: "phone", headerName: "Phone", width: 150 },
      {
        field: "role",
        headerName: "Role",
        width: 140,
        renderCell: (p) => <RoleChip role={p.row.role} />,
      },
      {
        field: "active",
        headerName: "Status",
        width: 120,
        renderCell: (p) =>
          p.row.active ? (
            <Chip label="Active" color="success" size="small" />
          ) : (
            <Chip label="Disabled" size="small" />
          ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 210,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const isSelf = p.row.id === selfId;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => setEditing(p.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset password">
                <IconButton size="small" onClick={() => setResetting(p.row)}>
                  <KeyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={p.row.active ? "Deactivate" : "Activate"}>
                <span>
                  <IconButton
                    size="small"
                    color={p.row.active ? "warning" : "success"}
                    disabled={pending || (isSelf && p.row.active)}
                    onClick={() => toggleActive(p.row)}
                  >
                    {p.row.active ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={pending || isSelf}
                    onClick={() => setDeleting(p.row)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, selfId]
  );

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h6">Console Users</Typography>
        <Button startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New User
        </Button>
      </Stack>

      {users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Create SuperAdmin or Admin accounts for the console."
          actionLabel="New User"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <ResponsiveTable
          rows={users}
          columns={columns}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          gridMinWidth={720}
          searchPlaceholder="Search users..."
          filterText={(row) => `${row.name} ${row.phone} ${ROLE_LABEL[row.role]}`}
          renderCard={(row) => {
            const isSelf = row.id === selfId;
            return (
              <DataCard
                title={row.name}
                subtitle={row.phone}
                right={
                  row.active ? (
                    <Chip label="Active" color="success" size="small" />
                  ) : (
                    <Chip label="Disabled" size="small" />
                  )
                }
                fields={[{ label: "Role", value: ROLE_LABEL[row.role] }]}
                actions={[
                  { label: "Edit", icon: <EditIcon fontSize="small" />, onClick: () => setEditing(row) },
                  { label: "Reset password", icon: <KeyIcon fontSize="small" />, onClick: () => setResetting(row) },
                  ...(!(isSelf && row.active)
                    ? [
                        row.active
                          ? {
                              label: "Deactivate",
                              icon: <BlockIcon fontSize="small" />,
                              danger: true,
                              onClick: () => toggleActive(row),
                            }
                          : {
                              label: "Activate",
                              icon: <CheckCircleIcon fontSize="small" />,
                              onClick: () => toggleActive(row),
                            },
                      ]
                    : []),
                  ...(!isSelf
                    ? [
                        {
                          label: "Delete",
                          icon: <DeleteIcon fontSize="small" />,
                          danger: true,
                          onClick: () => setDeleting(row),
                        },
                      ]
                    : []),
                ]}
              />
            );
          }}
        />
      )}

      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <UserFormDialog user={editing} onClose={() => setEditing(null)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={`Permanently delete ${deleting?.name ?? "this user"}? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}

/** Create (no `user`) or edit (with `user`) a console user. */
function UserFormDialog({
  open,
  user,
  onClose,
}: {
  open?: boolean;
  user?: PlatformUserRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const isEdit = !!user;
  const isOpen = isEdit ? !!user : !!open;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "platform_admin" as ConsoleRole,
  });

  // Load selected user's values when the edit dialog opens.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (user && user.id !== loadedId) {
    setLoadedId(user.id);
    setError(null);
    setForm({ name: user.name, phone: user.phone, password: "", role: user.role });
  }
  if (!user && isEdit === false && loadedId !== null) setLoadedId(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    setError(null);
    start(async () => {
      const res = isEdit
        ? await updateUser(user!.id, { name: form.name, phone: form.phone, role: form.role })
        : await createUser(form);
      if (res.ok) {
        toast.success(isEdit ? "User updated." : "User created.");
        if (!isEdit) setForm({ name: "", phone: "", password: "", role: "platform_admin" });
        onClose();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      disableClose={pending}
      title={isEdit ? "Edit User" : "New User"}
      actions={
        <>
          <Button color="inherit" variant="text" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Name *" value={form.name} onChange={set("name")} />
        <TextField
          label="Phone * (login)"
          value={form.phone}
          onChange={set("phone")}
          inputProps={{ inputMode: "tel" }}
          autoComplete="off"
        />
        {!isEdit && (
          <TextField
            label="Password *"
            type="password"
            value={form.password}
            onChange={set("password")}
            helperText="At least 6 characters"
            autoComplete="new-password"
          />
        )}
        <TextField
          select
          label="Role *"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as ConsoleRole }))}
          helperText="SuperAdmin has full access; Admin is read-only."
        >
          <MenuItem value="platform_admin">Admin (read-only)</MenuItem>
          <MenuItem value="superadmin">SuperAdmin (full access)</MenuItem>
        </TextField>
      </Stack>
    </ResponsiveDialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: PlatformUserRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (user && user.id !== loadedId) {
    setLoadedId(user.id);
    setError(null);
    setPassword("");
  }
  if (!user && loadedId !== null) setLoadedId(null);

  function submit() {
    if (!user) return;
    setError(null);
    start(async () => {
      const res = await resetUserPassword(user.id, password);
      if (res.ok) {
        toast.success("Password reset.");
        onClose();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <ResponsiveDialog
      open={!!user}
      onClose={onClose}
      disableClose={pending}
      title={`Reset password — ${user?.name ?? ""}`}
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" variant="text" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving..." : "Reset"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="New password *"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="At least 6 characters"
          autoComplete="new-password"
          autoFocus
        />
      </Stack>
    </ResponsiveDialog>
  );
}
