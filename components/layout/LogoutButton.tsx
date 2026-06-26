"use client";
import { useState } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LogoutIcon from "@mui/icons-material/Logout";
import Tooltip from "@mui/material/Tooltip";
import { logoutAction } from "@/lib/auth/actions";

export default function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const handle = () => {
    setLoading(true);
    // logoutAction redirects; no need to reset loading.
    logoutAction();
  };

  if (iconOnly) {
    return (
      <Tooltip title="লগআউট">
        <IconButton color="inherit" onClick={handle} disabled={loading}>
          <LogoutIcon />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <Button
      color="inherit"
      variant="text"
      startIcon={<LogoutIcon />}
      onClick={handle}
      disabled={loading}
    >
      লগআউট
    </Button>
  );
}
