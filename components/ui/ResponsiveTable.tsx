"use client";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
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
  searchPlaceholder = "Search...",
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
  const [search, setSearch] = useState("");

  // One instant, no-reload filter shared by BOTH presentations (cards + grid).
  const filtered = useMemo(() => {
    if (!filterText || !search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => filterText(r).toLowerCase().includes(q));
  }, [rows, filterText, search]);

  // When we own a prominent search field, the grid's built-in quick filter is
  // redundant; keep it only as a fallback for tables that pass no filterText.
  function Toolbar() {
    return (
      <GridToolbarContainer sx={{ p: 1, gap: 1 }}>
        <GridToolbarFilterButton />
        {extraToolbar}
        <Box sx={{ flex: 1 }} />
        {!filterText && <GridToolbarQuickFilter placeholder={searchPlaceholder} />}
      </GridToolbarContainer>
    );
  }

  return (
    <>
      {/* Prominent instant search — visible on mobile and desktop alike */}
      {filterText && (
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          size="small"
          fullWidth
          sx={{ mb: 1.5, maxWidth: { md: 420 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" aria-label="clear search" onClick={() => setSearch("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      )}

      {/* Mobile: cards */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Nothing found.
          </Typography>
        ) : (
          <Stack spacing={1.25}>{filtered.map((r) => <Box key={r.id}>{renderCard(r)}</Box>)}</Stack>
        )}
      </Box>

      {/* Desktop: DataGrid (fed the same filtered rows) */}
      <Box sx={{ display: { xs: "none", md: "block" }, width: "100%" }}>
        <Box sx={{ minWidth: gridMinWidth }}>
          <DataGrid
            autoHeight
            rows={filtered}
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
