"use client";
import type { ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import CloseIcon from "@mui/icons-material/Close";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

/**
 * A dialog that becomes a full-screen sheet on phones (easier data entry) and a
 * centered modal on desktop. The action bar sticks to the bottom so the primary
 * button is always thumb-reachable on long mobile forms.
 */
export default function ResponsiveDialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
  disableClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: "xs" | "sm" | "md";
  disableClose?: boolean;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={disableClose ? undefined : onClose}
      fullScreen={fullScreen}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}
    >
      {fullScreen ? (
        <AppBar position="sticky" color="primary" enableColorOnDark>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
              {title}
            </Typography>
            <IconButton color="inherit" edge="end" onClick={onClose} disabled={disableClose}>
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      ) : (
        <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      )}

      <DialogContent sx={{ pt: fullScreen ? 3 : 1 }}>
        <Box sx={{ mt: fullScreen ? 0 : 0.5 }}>{children}</Box>
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            p: 2,
            gap: 1,
            position: "sticky",
            bottom: 0,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            "& > :not(:first-of-type)": { ml: 0 },
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
