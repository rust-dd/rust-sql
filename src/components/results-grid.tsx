import { useRef, useMemo, useState, useCallback, useEffect, useImperativeHandle, useLayoutEffect, type MutableRefObject } from "react";
import DataEditor, {
  type GridColumn,
  type GridCell,
  GridCellKind,
  type Item,
  type EditableGridCell,
  type Theme,
  type GridSelection,
  CompactSelection,
  type DataEditorRef,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useUIStore } from "@/stores/ui-store";
import * as virtualCache from "@/lib/virtual-cache";
import type { VirtualQuery } from "@/types";

interface ResultsGridProps {
  columns: string[];
  rows: string[][];
  isEditing?: boolean;
  cellEdits?: Map<string, string>;
  deletedRows?: Set<number>;
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
  onRowDelete?: (rowIndex: number) => void;
  onRowRestore?: (rowIndex: number) => void;
  fkColumns?: Map<string, { schema: string; table: string; column: string }>;
  onFKNavigate?: (colName: string, value: string) => void;
  virtualQuery?: VirtualQuery;
  onPageNeeded?: (pageIndex: number) => void;
  onViewportRowChange?: (topRow: number) => void;
  restoreRowIndex?: number; // can be fractional when smooth scroll is active
  viewportKey?: string;
  gridRef?: MutableRefObject<{ invalidatePage: (pageIndex: number) => void } | null>;
}

const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 400;
const CHAR_WIDTH = 7.5;
const PADDING = 24;
const GRID_ROW_HEIGHT = 32;

// Pre-allocated static cell for unloaded virtual rows — avoids GC pressure
const LOADING_CELL: GridCell = {
  kind: GridCellKind.Text,
  data: "",
  displayData: "\u2026",
  allowOverlay: false,
  readonly: true,
  themeOverride: { textDark: "#888", textLight: "#666" },
};

export function ResultsGrid({
  columns,
  rows,
  isEditing,
  cellEdits,
  deletedRows,
  onCellEdit,
  onRowDelete,
  onRowRestore,
  fkColumns,
  onFKNavigate,
  virtualQuery,
  onPageNeeded,
  onViewportRowChange,
  restoreRowIndex,
  viewportKey,
  gridRef,
}: ResultsGridProps) {
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataEditorRef = useRef<DataEditorRef>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });
  const visibleRangeRef = useRef({ y: 0, height: 0 });

  useImperativeHandle(gridRef ?? { current: null }, () => ({
    invalidatePage: (_pageIndex: number) => {
      if (!virtualQuery) return;
      const totalRows = virtualQuery.totalRows;
      if (totalRows <= 0) return;

      const range = visibleRangeRef.current;
      const visibleStart = Math.max(0, Math.floor(range.y) - 2);
      const fallbackVisibleRows = Math.max(24, Math.ceil(containerSize.height / GRID_ROW_HEIGHT) + 4);
      const effectiveHeight = range.height > 0 ? range.height : fallbackVisibleRows;
      const visibleEnd = Math.min(totalRows - 1, Math.ceil(range.y + effectiveHeight) + 2);
      if (visibleStart > visibleEnd) return;

      const cells: { cell: Item }[] = [];
      for (let row = visibleStart; row <= visibleEnd; row++) {
        for (let col = 0; col < columns.length; col++) {
          cells.push({ cell: [col, row] });
        }
      }
      if (cells.length > 0) {
        dataEditorRef.current?.updateCells(cells);
      }
    },
  }), [columns.length, containerSize.height, virtualQuery]);

  // Observe container size (debounced to avoid mid-scroll re-renders)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId = 0;
    const obs = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        const w = Math.round(width);
        const h = Math.round(height);
        setContainerSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      });
    });
    obs.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      obs.disconnect();
    };
  }, []);

  // Calculate column widths based on content
  const gridColumns = useMemo((): GridColumn[] => {
    const sampleRows = rows.slice(0, 100);
    return columns.map((col, colIdx) => {
      let maxLen = col.length + 2;
      for (const row of sampleRows) {
        const cellLen = (row[colIdx] ?? "").length;
        if (cellLen > maxLen) maxLen = cellLen;
      }
      const width = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, maxLen * CHAR_WIDTH + PADDING));
      return { title: col, id: col, width };
    });
  }, [columns, rows]);

  // Build set of FK column indices for fast lookup
  const fkColIndices = useMemo(() => {
    if (!fkColumns || fkColumns.size === 0) return new Set<number>();
    const s = new Set<number>();
    columns.forEach((col, idx) => {
      if (fkColumns.has(col)) s.add(idx);
    });
    return s;
  }, [columns, fkColumns]);

  // Pre-compute theme override objects — avoids creating new objects per cell render
  const deletedOverride = useMemo(() => (
    { bgCell: "rgba(239, 68, 68, 0.1)", textDark: "#999", textLight: "#999" }
  ), []);
  const modifiedOverride = useMemo(() => (
    { bgCell: theme === "dark" ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)" }
  ), [theme]);
  const fkOverride = useMemo(() => (
    { textDark: "hsl(220, 70%, 50%)", textLight: "hsl(220, 70%, 65%)" }
  ), []);

  // Total row count: virtual mode uses totalRows, otherwise rows.length
  const totalRowCount = virtualQuery ? virtualQuery.totalRows : rows.length;

  // Restore previous viewport row when switching back to a tab/query.
  useLayoutEffect(() => {
    if (typeof restoreRowIndex !== "number" || totalRowCount <= 0) return;
    const targetRow = Math.min(restoreRowIndex, totalRowCount - 1);
    if (targetRow > 0) {
      dataEditorRef.current?.scrollTo(
        0,
        { amount: targetRow, unit: "cell" },
        "vertical",
        0,
        0,
        { vAlign: "start" },
      );
    }
    visibleRangeRef.current = { ...visibleRangeRef.current, y: targetRow };
    onViewportRowChange?.(targetRow);
  }, [viewportKey, restoreRowIndex, totalRowCount]);

  // Get cell content callback (the core of glide-data-grid)
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIdx, rowIdx] = cell;

      // Virtual mode: read from cache
      if (virtualQuery) {
        const pageIndex = Math.floor(rowIdx / virtualQuery.pageSize);
        const row = virtualCache.getRow(virtualQuery.queryId, rowIdx, virtualQuery.pageSize);
        if (!row) {
          onPageNeeded?.(pageIndex);
          const fallbackRow = rows[rowIdx];
          if (!fallbackRow) return LOADING_CELL;
          const value = fallbackRow[colIdx] ?? "";
          return {
            kind: GridCellKind.Text,
            data: value,
            displayData: value,
            allowOverlay: false,
            readonly: true,
          };
        }
        const value = row[colIdx] ?? "";
        return {
          kind: GridCellKind.Text,
          data: value,
          displayData: value,
          allowOverlay: false,
          readonly: true,
        };
      }

      const key = `${rowIdx}:${colIdx}`;
      const isModified = cellEdits?.has(key);
      const isDeleted = deletedRows?.has(rowIdx);
      const isFK = fkColIndices.has(colIdx) && !isEditing;
      const value = isModified ? cellEdits!.get(key)! : (rows[rowIdx]?.[colIdx] ?? "");

      const baseCell: GridCell = {
        kind: GridCellKind.Text,
        data: value,
        displayData: isFK && value !== "null" ? `${value} \u2192` : value,
        allowOverlay: !!isEditing && !isDeleted,
        readonly: !isEditing || !!isDeleted,
        themeOverride: isDeleted
          ? deletedOverride
          : isModified
            ? modifiedOverride
            : isFK && value !== "null"
              ? fkOverride
              : undefined,
      };

      return baseCell;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cellEdits, deletedRows, isEditing, theme, fkColIndices, virtualQuery, onPageNeeded],
  );

  // Virtual scroll handler: trigger page loads on scroll (throttled via rAF)
  const scrollRafId = useRef(0);
  const handleVisibleRegionChanged = useCallback(
    (range: { x: number; y: number; width: number; height: number }) => {
      visibleRangeRef.current = { y: range.y, height: range.height };
      onViewportRowChange?.(Math.max(0, range.y));
      if (!virtualQuery || !onPageNeeded) return;
      cancelAnimationFrame(scrollRafId.current);
      scrollRafId.current = requestAnimationFrame(() => {
        const { y, height } = range;
        const ps = virtualQuery.pageSize;
        const firstVisible = Math.floor(y / ps);
        const lastVisible = Math.floor((y + height) / ps);
        for (let p = firstVisible - 1; p <= lastVisible + 3; p++) {
          if (p >= 0 && p * ps < virtualQuery.totalRows) {
            onPageNeeded(p);
          }
        }
      });
    },
    [virtualQuery, onPageNeeded, onViewportRowChange],
  );

  useEffect(() => () => {
    cancelAnimationFrame(scrollRafId.current);
  }, []);

  // Handle cell edit
  const onCellEdited = useCallback(
    (cell: Item, newVal: EditableGridCell) => {
      if (newVal.kind !== GridCellKind.Text) return;
      const [colIdx, rowIdx] = cell;
      onCellEdit?.(rowIdx, colIdx, newVal.data);
    },
    [onCellEdit],
  );

  // Cell click → FK navigate only
  const handleRowClick = useCallback(
    (cell: Item) => {
      if (isEditing || virtualQuery) return;
      const [colIdx, rowIdx] = cell;

      // FK navigation: if clicking an FK column, navigate to the referenced row
      if (fkColIndices.has(colIdx) && onFKNavigate) {
        const colName = columns[colIdx];
        const value = rows[rowIdx]?.[colIdx] ?? "";
        if (value && value !== "null") {
          onFKNavigate(colName, value);
        }
      }
    },
    [isEditing, virtualQuery, fkColIndices, onFKNavigate, columns, rows],
  );

  // Theme for glide-data-grid
  const gridTheme = useMemo((): Partial<Theme> => {
    if (theme === "dark") {
      return {
        accentColor: "hsl(260, 70%, 60%)",
        accentLight: "hsla(260, 70%, 60%, 0.15)",
        bgCell: "hsl(250, 15%, 13%)",
        bgCellMedium: "hsl(250, 15%, 15%)",
        bgHeader: "hsl(250, 15%, 18%)",
        bgHeaderHasFocus: "hsl(250, 15%, 22%)",
        bgHeaderHovered: "hsl(250, 15%, 20%)",
        borderColor: "hsl(250, 12%, 22%)",
        drilldownBorder: "hsl(250, 12%, 30%)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        headerFontStyle: "bold 12px",
        baseFontStyle: "12px",
        textDark: "hsl(250, 15%, 85%)",
        textMedium: "hsl(250, 10%, 60%)",
        textLight: "hsl(250, 10%, 45%)",
        textHeader: "hsl(250, 15%, 75%)",
        textHeaderSelected: "hsl(260, 70%, 75%)",
        bgBubble: "hsl(250, 15%, 20%)",
        bgBubbleSelected: "hsl(260, 70%, 60%)",
        textBubble: "hsl(250, 15%, 85%)",
      };
    }
    return {
      accentColor: "hsl(260, 70%, 55%)",
      accentLight: "hsla(260, 70%, 55%, 0.1)",
      bgCell: "#ffffff",
      bgCellMedium: "#fafafa",
      bgHeader: "#f5f5f8",
      bgHeaderHasFocus: "#eeeef2",
      bgHeaderHovered: "#f0f0f4",
      borderColor: "#e2e2e8",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      headerFontStyle: "bold 12px",
      baseFontStyle: "12px",
      textDark: "#1a1a2e",
      textMedium: "#666680",
      textLight: "#9999a8",
      textHeader: "#333340",
    };
  }, [theme]);

  // Row markers for delete buttons when editing
  const rowMarkers = isEditing ? ("checkbox-visible" as const) : ("none" as const);
  const [selection, setSelection] = useState<GridSelection>({
    rows: CompactSelection.empty(),
    columns: CompactSelection.empty(),
  });

  // Handle row selection change for deleting
  useEffect(() => {
    if (!isEditing) {
      setSelection({ rows: CompactSelection.empty(), columns: CompactSelection.empty() });
    }
  }, [isEditing]);

  // Sync deletedRows to selection
  useEffect(() => {
    if (!isEditing || !deletedRows) return;
    let sel = CompactSelection.empty();
    for (const idx of deletedRows) {
      sel = sel.add(idx);
    }
    setSelection((prev) => ({ ...prev, rows: sel }));
  }, [isEditing, deletedRows]);

  const handleSelectionChange = useCallback(
    (newSel: GridSelection) => {
      if (!isEditing) return;
      // Find changes between old and new selection
      const oldRows = selection.rows;
      const newRows = newSel.rows;

      // Check for newly added rows (marked for deletion)
      for (let i = 0; i < rows.length; i++) {
        const wasSelected = oldRows.hasIndex(i);
        const isSelected = newRows.hasIndex(i);
        if (isSelected && !wasSelected) onRowDelete?.(i);
        if (!isSelected && wasSelected) onRowRestore?.(i);
      }

      setSelection(newSel);
    },
    [isEditing, selection, rows.length, onRowDelete, onRowRestore],
  );

  return (
    <div ref={containerRef} className="results-grid-scroll flex-1 min-h-0 overflow-hidden">
      <DataEditor
        ref={dataEditorRef}
        columns={gridColumns}
        rows={totalRowCount}
        getCellContent={getCellContent}
        onCellEdited={isEditing ? onCellEdited : undefined}
        onCellClicked={handleRowClick}
        onVisibleRegionChanged={handleVisibleRegionChanged}
        theme={gridTheme}
        width={containerSize.width}
        height={containerSize.height}
        smoothScrollX
        smoothScrollY={!virtualQuery}
        experimental={{ renderStrategy: "direct" }}
        rowMarkers={rowMarkers}
        gridSelection={isEditing ? selection : undefined}
        onGridSelectionChange={isEditing ? handleSelectionChange : undefined}
        getCellsForSelection={true}
        keybindings={{ search: !virtualQuery }}
        overscrollX={0}
        overscrollY={0}
        rowHeight={GRID_ROW_HEIGHT}
        headerHeight={34}
      />
    </div>
  );
}
