"use client";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarFilterButton,
  type GridColDef,
  type GridRowIdGetter,
} from "@mui/x-data-grid";

type WithId = { id: string };

/**
 * One data source, two presentations:
 *  - md and up: MUI X DataGrid (sort, filter, per-column search, export).
 *  - below md: a stack of cards (DataGrid is unusable on a phone).
 * Both are always mounted and toggled with CSS so there is no hydration flash;
 * only the visible one is interactive.
 */
export default function ResponsiveTable<T extends WithId>({
  rows,
  columns,
  renderCard,
  filterText,
  searchPlaceholder = "খুঁজুন...",
  extraToolbar,
  pageSize = 25,
  pageSizeOptions = [25, 50, 100],
  getRowId,
  gridMinWidth,
}: {
  rows: T[];
  columns: GridColDef<T>[];
  renderCard: (row: T) => ReactNode;
  filterText?: (row: T) => string;
  searchPlaceholder?: string;
  extraToolbar?: ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  getRowId?: GridRowIdGetter<T>;
  gridMinWidth?: number;
}) {
  const [mobileSearch, setMobileSearch] = useState("");

  const mobileRows = useMemo(() => {
    if (!filterText || !mobileSearch.trim()) return rows;
    const q = mobileSearch.trim().toLowerCase();
    return rows.filter((r) => filterText(r).toLowerCase().includes(q));
  }, [rows, filterText, mobileSearch]);

  function Toolbar() {
    return (
      <GridToolbarContainer sx={{ p: 1, gap: 1 }}>
        <GridToolbarFilterButton />
        {extraToolbar}
        <Box sx={{ flex: 1 }} />
        <GridToolbarQuickFilter placeholder={searchPlaceholder} />
      </GridToolbarContainer>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {filterText && (
          <TextField
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            placeholder={searchPlaceholder}
            size="small"
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        )}
        {mobileRows.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            কিছু পাওয়া যায়নি।
          </Typography>
        ) : (
          <Stack spacing={1.25}>{mobileRows.map((r) => <Box key={r.id}>{renderCard(r)}</Box>)}</Stack>
        )}
      </Box>

      {/* Desktop: DataGrid */}
      <Box sx={{ display: { xs: "none", md: "block" }, width: "100%" }}>
        <Box sx={{ minWidth: gridMinWidth }}>
          <DataGrid
            autoHeight
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            disableRowSelectionOnClick
            slots={{ toolbar: Toolbar }}
            initialState={{ pagination: { paginationModel: { pageSize } } }}
            pageSizeOptions={pageSizeOptions}
            sx={{ border: 0 }}
          />
        </Box>
      </Box>
    </>
  );
}
