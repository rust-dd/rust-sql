import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import DataEditor, {
  type GridColumn,
  type GridCell,
  GridCellKind,
  type Item,
  type EditableGridCell,
  type Theme,
  type GridSelection,
  CompactSelection,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useUIStore } from "@/stores/ui-store";

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
}

const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 400;
const CHAR_WIDTH = 7.5;
const PADDING = 24;

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
}: ResultsGridProps) {
  const setSelectedRow = useUIStore((s) => s.setSelectedRow);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });

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
    return columns.map((col) => {
      const colIdx = columns.indexOf(col);
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

  // Get cell content callback (the core of glide-data-grid)
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIdx, rowIdx] = cell;
      const key = `${rowIdx}:${colIdx}`;
      const isModified = cellEdits?.has(key);
      const isDeleted = deletedRows?.has(rowIdx);
      const isFK = fkColIndices.has(colIdx) && !isEditing;
      const value = isModified ? cellEdits!.get(key)! : (rows[rowIdx]?.[colIdx] ?? "");

      const baseCell: GridCell = {
        kind: GridCellKind.Text,
        data: value,
        displayData: isFK && value !== "null" ? `${value} →` : value,
        allowOverlay: !!isEditing && !isDeleted,
        readonly: !isEditing || !!isDeleted,
        themeOverride: isDeleted
          ? { bgCell: "rgba(239, 68, 68, 0.1)", textDark: "#999", textLight: "#999" }
          : isModified
            ? { bgCell: theme === "dark" ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.1)" }
            : isFK && value !== "null"
              ? { textDark: "hsl(220, 70%, 50%)", textLight: "hsl(220, 70%, 65%)" }
              : undefined,
      };

      return baseCell;
    },
    [rows, cellEdits, deletedRows, isEditing, theme, fkColIndices],
  );

  // Handle cell edit
  const onCellEdited = useCallback(
    (cell: Item, newVal: EditableGridCell) => {
      if (newVal.kind !== GridCellKind.Text) return;
      const [colIdx, rowIdx] = cell;
      onCellEdit?.(rowIdx, colIdx, newVal.data);
    },
    [onCellEdit],
  );

  // Cell click → FK navigate or record view
  const handleRowClick = useCallback(
    (cell: Item) => {
      if (isEditing) return;
      const [colIdx, rowIdx] = cell;

      // FK navigation: if clicking an FK column, navigate to the referenced row
      if (fkColIndices.has(colIdx) && onFKNavigate) {
        const colName = columns[colIdx];
        const value = rows[rowIdx]?.[colIdx] ?? "";
        if (value && value !== "null") {
          onFKNavigate(colName, value);
          return;
        }
      }

      setSelectedRow(rowIdx);
      setViewMode("record");
    },
    [isEditing, setSelectedRow, setViewMode, fkColIndices, onFKNavigate, columns, rows],
  );

  // Theme for glide-data-grid
  const gridTheme = useMemo((): Partial<Theme> => {
    if (theme === "dark") {
      return {
        accentColor: "hsl(220, 70%, 55%)",
        accentLight: "hsla(220, 70%, 55%, 0.15)",
        bgCell: "hsl(224, 20%, 12%)",
        bgCellMedium: "hsl(224, 20%, 14%)",
        bgHeader: "hsl(224, 20%, 16%)",
        bgHeaderHasFocus: "hsl(224, 20%, 20%)",
        bgHeaderHovered: "hsl(224, 20%, 18%)",
        borderColor: "hsl(224, 10%, 22%)",
        drilldownBorder: "hsl(224, 10%, 30%)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        headerFontStyle: "bold 12px",
        baseFontStyle: "12px",
        textDark: "hsl(220, 15%, 85%)",
        textMedium: "hsl(220, 10%, 60%)",
        textLight: "hsl(220, 10%, 45%)",
        textHeader: "hsl(220, 15%, 75%)",
        textHeaderSelected: "hsl(220, 70%, 75%)",
        bgBubble: "hsl(224, 20%, 20%)",
        bgBubbleSelected: "hsl(220, 70%, 55%)",
        textBubble: "hsl(220, 15%, 85%)",
      };
    }
    return {
      accentColor: "hsl(220, 70%, 50%)",
      accentLight: "hsla(220, 70%, 50%, 0.1)",
      bgCell: "#ffffff",
      bgCellMedium: "#fafafa",
      bgHeader: "#f5f5f5",
      bgHeaderHasFocus: "#eee",
      bgHeaderHovered: "#f0f0f0",
      borderColor: "#e5e5e5",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      headerFontStyle: "bold 12px",
      baseFontStyle: "12px",
      textDark: "#1a1a1a",
      textMedium: "#666",
      textLight: "#999",
      textHeader: "#333",
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
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
      <DataEditor
        columns={gridColumns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={isEditing ? onCellEdited : undefined}
        onCellClicked={handleRowClick}
        theme={gridTheme}
        width={containerSize.width}
        height={containerSize.height}
        smoothScrollX
        smoothScrollY
        experimental={{ renderStrategy: "direct" }}
        rowMarkers={rowMarkers}
        gridSelection={isEditing ? selection : undefined}
        onGridSelectionChange={isEditing ? handleSelectionChange : undefined}
        getCellsForSelection={true}
        keybindings={{ search: true }}
        overscrollX={0}
        overscrollY={0}
        rowHeight={32}
        headerHeight={34}
      />
    </div>
  );
}
