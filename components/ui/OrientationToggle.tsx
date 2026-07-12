"use client";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import CropPortraitIcon from "@mui/icons-material/CropPortrait";
import CropLandscapeIcon from "@mui/icons-material/CropLandscape";

export type Orientation = "portrait" | "landscape";

/**
 * Compact page-orientation switch for printable documents (Payment Matrix,
 * Transcript). Reused wherever a "Print / Save as PDF" action lets the user
 * pick paper orientation. Styled to sit inline with the toolbar's outlined
 * export buttons (same height, primary accent when active).
 */
export default function OrientationToggle({
  value,
  onChange,
  size = "small",
}: {
  value: Orientation;
  onChange: (o: Orientation) => void;
  size?: "small" | "medium";
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={value}
      onChange={(_e, v: Orientation | null) => v && onChange(v)}
      aria-label="Print orientation"
      sx={{
        "& .MuiToggleButton-root": { px: 1.25, textTransform: "none", gap: 0.5 },
      }}
    >
      <ToggleButton value="portrait" aria-label="Portrait">
        <Tooltip title="Portrait">
          <CropPortraitIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="landscape" aria-label="Landscape">
        <Tooltip title="Landscape">
          <CropLandscapeIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
