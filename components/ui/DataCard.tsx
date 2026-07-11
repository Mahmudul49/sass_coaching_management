"use client";
import { useState, type ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { alpha } from "@mui/material/styles";

export type CardAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

/**
 * Standard mobile "row as a card": a title, optional subtitle, a right-aligned
 * status slot, a set of label/value fields, and an overflow actions menu.
 */
export default function DataCard({
  title,
  subtitle,
  right,
  fields = [],
  actions = [],
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  fields?: { label: string; value: ReactNode }[];
  actions?: CardAction[];
  onClick?: () => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        transition: "border-color .16s ease, box-shadow .16s ease, transform .16s ease",
        "&:hover": {
          borderColor: (t) => alpha(t.palette.primary.main, 0.3),
          boxShadow: 2,
          ...(onClick && { transform: "translateY(-1px)" }),
        },
      }}
    >
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box
            sx={{ flex: 1, minWidth: 0, cursor: onClick ? "pointer" : "default" }}
            onClick={onClick}
          >
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
          {right}
          {actions.length > 0 && (
            <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} edge="end">
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {fields.length > 0 && (
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            sx={{
              mt: 1.5,
              pt: 1.5,
              gap: 1.5,
              columnGap: 3,
              borderTop: "1px dashed",
              borderColor: "divider",
            }}
          >
            {fields.map((f, i) => (
              <Box key={i}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.64rem", fontWeight: 600 }}
                >
                  {f.label}
                </Typography>
                <Typography variant="body2" fontWeight={650} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {f.value}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {actions.map((a, i) => (
          <MenuItem
            key={i}
            onClick={() => {
              setAnchor(null);
              a.onClick();
            }}
            sx={a.danger ? { color: "error.main" } : undefined}
          >
            {a.icon && (
              <ListItemIcon sx={a.danger ? { color: "error.main" } : undefined}>{a.icon}</ListItemIcon>
            )}
            <ListItemText>{a.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Card>
  );
}
