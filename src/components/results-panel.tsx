import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useActiveTab } from "@/stores/tab-store";
import { useTabStore } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useProjectStore } from "@/stores/project-store";
import { DriverFactory } from "@/lib/database-driver";
import {
  CheckCircle2,
  Clock,
  Copy,
  Diff,
  Download,
  Edit3,
  GitBranch,
  History,
  Loader2,
  Pin,
  Save,
  Search,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { ResultsGrid } from "./results-grid";
import { ResultsRecord } from "./results-record";
import { QueryHistory } from "./query-history";
import { ExplainPanel } from "./explain-panel";
import { exportResults, copyToClipboard, type ExportFormat } from "@/lib/export";
import { parseSelectTable, generateUpdate, generateDelete, quoteIdent, quoteLiteral } from "@/lib/sql-utils";
import { ResultsMap, hasGeometryColumn } from "./results-map";
import type { ForeignKey } from "@/lib/database-driver";
import * as virtualCache from "@/lib/virtual-cache";

const CELL_SEP = "\x1F";
const ROW_SEP = "\x1E";
const MAX_CONCURRENT_PAGE_FETCHES = 6;
const MAX_QUEUED_PAGE_FETCHES = 32;
const CACHE_WINDOW_PAGES = 24;

type PanelView = "grid" | "record" | "history" | "explain" | "diff" | "map";

interface EditState {
  schema: string;
  table: string;
  pkColumns: string[];
  cellEdits: Map<string, string>;
  deletedRows: Set<number>;
}

export function ResultsPanel() {
  const activeTab = useActiveTab();
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const pinnedResult = useUIStore((s) => s.pinnedResult);
  const [panelView, setPanelView] = useState<PanelView>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search term — avoids filtering 50K rows on every keystroke
  useEffect(() => {
    if (!searchTerm.trim()) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const result = activeTab?.result;
  const isExecuting = activeTab?.isExecuting;
  const vq = activeTab?.virtualQuery;

  // Cancel running query
  const handleCancel = useCallback(async () => {
    if (!activeTab?.projectId || !activeTab.isExecuting) return;
    const d = useProjectStore.getState().projects[activeTab.projectId];
    if (!d) return;
    try {
      const driver = DriverFactory.getDriver(d.driver);
      await driver.cancelQuery?.(activeTab.projectId);
    } catch (err) {
      console.error("Failed to cancel query:", err);
    }
  }, [activeTab?.projectId, activeTab?.isExecuting]);

  // Virtual page loading
  const loadingPages = useRef(new Set<number>());
  const queuedPages = useRef<number[]>([]);
  const queuedPageSet = useRef(new Set<number>());
  const activeFetches = useRef(0);
  const latestRequestedPage = useRef(0);
  const gridRef = useRef<{ invalidate: () => void }>(null);

  useEffect(() => {
    loadingPages.current.clear();
    queuedPages.current = [];
    queuedPageSet.current.clear();
    activeFetches.current = 0;
  }, [vq?.queryId, activeTab?.projectId]);

  const fetchPage = useCallback(async (pageIndex: number) => {
    if (!vq || !activeTab?.projectId) return;
    const d = useProjectStore.getState().projects[activeTab.projectId];
    if (!d) return;
    const driver = DriverFactory.getDriver(d.driver);
    if (!driver.fetchPage) return;

    const offset = pageIndex * vq.pageSize;
    const packed = await driver.fetchPage(activeTab.projectId, vq.queryId, vq.colCount, offset, vq.pageSize);

    // Drop stale page responses after tab/query switches.
    const selectedIdx = useTabStore.getState().selectedTabIndex;
    const selectedTab = useTabStore.getState().tabs[selectedIdx];
    if (selectedTab?.virtualQuery?.queryId !== vq.queryId) return;

    const rows = packed ? packed.split(ROW_SEP).map((r) => r.split(CELL_SEP)) : [];
    virtualCache.setPage(vq.queryId, pageIndex, rows);
    // Evict around the user's latest viewport, not the page that happened to resolve last.
    virtualCache.evictDistant(vq.queryId, latestRequestedPage.current, CACHE_WINDOW_PAGES);
    gridRef.current?.invalidate();
  }, [vq, activeTab?.projectId]);

  const pumpQueue = useCallback(() => {
    if (!vq || !activeTab?.projectId) return;

    if (queuedPages.current.length > 1) {
      const target = latestRequestedPage.current;
      queuedPages.current.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    }

    while (activeFetches.current < MAX_CONCURRENT_PAGE_FETCHES && queuedPages.current.length > 0) {
      const pageIndex = queuedPages.current.shift()!;
      queuedPageSet.current.delete(pageIndex);

      if (loadingPages.current.has(pageIndex) || virtualCache.hasPage(vq.queryId, pageIndex)) {
        continue;
      }

      loadingPages.current.add(pageIndex);
      activeFetches.current += 1;

      void fetchPage(pageIndex).finally(() => {
        loadingPages.current.delete(pageIndex);
        activeFetches.current -= 1;
        pumpQueue();
      });
    }
  }, [vq, activeTab?.projectId, fetchPage]);

  const handlePageNeeded = useCallback((pageIndex: number) => {
    if (!vq || !activeTab?.projectId) return;
    latestRequestedPage.current = pageIndex;
    if (
      loadingPages.current.has(pageIndex)
      || virtualCache.hasPage(vq.queryId, pageIndex)
      || queuedPageSet.current.has(pageIndex)
    ) {
      return;
    }

    if (queuedPages.current.length >= MAX_QUEUED_PAGE_FETCHES) {
      queuedPages.current = queuedPages.current.filter((p) => Math.abs(p - pageIndex) <= 8);
      queuedPageSet.current = new Set(queuedPages.current);
    }

    queuedPages.current.push(pageIndex);
    queuedPageSet.current.add(pageIndex);
    pumpQueue();
  }, [vq, activeTab?.projectId, pumpQueue]);

  useEffect(() => {
    if (!vq) return;
    const startPage = 1;
    const endPage = Math.min(startPage + 3, Math.ceil(vq.totalRows / vq.pageSize) - 1);
    for (let p = startPage; p <= endPage; p++) {
      handlePageNeeded(p);
    }
  }, [vq?.queryId, vq?.totalRows, vq?.pageSize, handlePageNeeded]);

  const filteredRows = useMemo(() => {
    if (isEditing) return result?.rows ?? [];
    if (!result || !debouncedSearch.trim()) return result?.rows ?? [];
    const term = debouncedSearch.toLowerCase();
    return result.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(term)),
    );
  }, [result, debouncedSearch, isEditing]);

  const explainResult = activeTab?.explainResult;
  const hasExplain = !!explainResult;

  // Detect if query is a simple SELECT (editable)
  const editableTable = useMemo(() => {
    if (!activeTab?.editorValue) return null;
    return parseSelectTable(activeTab.editorValue);
  }, [activeTab?.editorValue]);

  // FK column map: columnName → { targetSchema, targetTable, targetColumn }
  const [fkMap, setFkMap] = useState<Map<string, { schema: string; table: string; column: string }>>(new Map());

  useEffect(() => {
    if (!editableTable || !activeTab?.projectId) {
      setFkMap(new Map());
      return;
    }
    const pid = activeTab.projectId;
    const d = useProjectStore.getState().projects[pid];
    if (!d) return;

    const driver = DriverFactory.getDriver(d.driver);
    driver.loadForeignKeys(pid, editableTable.schema).then((fks: ForeignKey[]) => {
      const map = new Map<string, { schema: string; table: string; column: string }>();
      for (const fk of fks) {
        if (fk.sourceTable === editableTable.table) {
          map.set(fk.sourceColumn, {
            schema: editableTable.schema,
            table: fk.targetTable,
            column: fk.targetColumn,
          });
        }
      }
      setFkMap(map);
    }).catch(() => setFkMap(new Map()));
  }, [editableTable, activeTab?.projectId]);

  // FK navigate handler - opens a new tab and auto-executes the query
  const handleFKNavigate = useCallback(
    (colName: string, value: string) => {
      const target = fkMap.get(colName);
      if (!target || !activeTab?.projectId) return;

      const pid = activeTab.projectId;
      const sql = `SELECT * FROM ${quoteIdent(target.schema)}.${quoteIdent(target.table)} WHERE ${quoteIdent(target.column)} = ${quoteLiteral(value)} LIMIT 100`;
      useTabStore.getState().openTab(pid, sql);

      // Auto-execute the query in the new tab
      const d = useProjectStore.getState().projects[pid];
      if (!d) return;
      const newTabIdx = useTabStore.getState().tabs.length - 1;
      useTabStore.getState().setExecuting(newTabIdx, true);
      const driver = DriverFactory.getDriver(d.driver);
      driver.runQuery(pid, sql).then(([cols, rows, time]) => {
        useTabStore.getState().updateResult(newTabIdx, { columns: cols, rows, time });
      }).catch(() => {
        useTabStore.getState().setExecuting(newTabIdx, false);
      });
    },
    [fkMap, activeTab?.projectId],
  );

  const changeCount = editState
    ? editState.cellEdits.size + editState.deletedRows.size
    : 0;

  // Enter edit mode
  const handleEnterEdit = useCallback(async () => {
    if (!editableTable || !activeTab?.projectId) return;
    const d = useProjectStore.getState().projects[activeTab.projectId];
    if (!d) return;
    setEditError(null);

    try {
      const driver = DriverFactory.getDriver(d.driver);
      const indexes = await driver.loadIndexes(
        activeTab.projectId,
        editableTable.schema,
        editableTable.table,
      );
      const pkColumns = [...new Set(indexes.filter((i) => i.isPrimary).map((i) => i.columnName))];

      if (pkColumns.length === 0) {
        setEditError("No primary key found. Inline editing requires a primary key.");
        return;
      }

      // Check that PK columns exist in result columns
      const resultCols = result?.columns ?? [];
      const missingPKs = pkColumns.filter((pk) => !resultCols.includes(pk));
      if (missingPKs.length > 0) {
        setEditError(`Primary key column(s) ${missingPKs.join(", ")} not in query results. Select all PK columns to edit.`);
        return;
      }

      setEditState({
        schema: editableTable.schema,
        table: editableTable.table,
        pkColumns,
        cellEdits: new Map(),
        deletedRows: new Set(),
      });
      setIsEditing(true);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to load table info");
    }
  }, [editableTable, activeTab?.projectId, result?.columns]);

  // Discard edits
  const handleDiscard = useCallback(() => {
    setIsEditing(false);
    setEditState(null);
    setEditError(null);
  }, []);

  // Commit edits
  const handleCommit = useCallback(async () => {
    if (!editState || !activeTab?.projectId || !result) return;
    const { schema, table, pkColumns, cellEdits, deletedRows } = editState;
    const columns = result.columns;
    const originalRows = result.rows;

    // Group cell edits by row
    const editsByRow = new Map<number, Map<number, string>>();
    for (const [key, value] of cellEdits) {
      const [rowStr, colStr] = key.split(":");
      const rowIdx = parseInt(rowStr);
      const colIdx = parseInt(colStr);
      if (deletedRows.has(rowIdx)) continue;
      if (!editsByRow.has(rowIdx)) editsByRow.set(rowIdx, new Map());
      editsByRow.get(rowIdx)!.set(colIdx, value);
    }

    const statements: string[] = [];

    for (const [rowIdx, changes] of editsByRow) {
      statements.push(generateUpdate(schema, table, columns, originalRows[rowIdx], changes, pkColumns));
    }

    for (const rowIdx of deletedRows) {
      statements.push(generateDelete(schema, table, columns, originalRows[rowIdx], pkColumns));
    }

    if (statements.length === 0) {
      handleDiscard();
      return;
    }

    setIsCommitting(true);
    setEditError(null);

    try {
      const d = useProjectStore.getState().projects[activeTab.projectId];
      if (!d) throw new Error("Project not found");
      const driver = DriverFactory.getDriver(d.driver);

      await driver.runQuery(activeTab.projectId, "BEGIN");
      try {
        for (const stmt of statements) {
          await driver.runQuery(activeTab.projectId, stmt);
        }
        await driver.runQuery(activeTab.projectId, "COMMIT");
      } catch (err) {
        await driver.runQuery(activeTab.projectId, "ROLLBACK").catch(() => {});
        throw err;
      }

      // Refresh results
      const [cols, rows, time] = await driver.runQuery(activeTab.projectId, activeTab.editorValue);
      const tabIdx = useTabStore.getState().selectedTabIndex;
      useTabStore.getState().updateResult(tabIdx, { columns: cols, rows, time });

      setIsEditing(false);
      setEditState(null);
    } catch (err: any) {
      setEditError(err?.message ?? "Commit failed");
    } finally {
      setIsCommitting(false);
    }
  }, [editState, activeTab?.projectId, activeTab?.editorValue, result, handleDiscard]);

  // Cell edit handler
  const handleCellEdit = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      setEditState((prev) => {
        if (!prev) return prev;
        const newEdits = new Map(prev.cellEdits);
        const original = result?.rows[rowIndex]?.[colIndex] ?? "";
        if (value === original) {
          newEdits.delete(`${rowIndex}:${colIndex}`);
        } else {
          newEdits.set(`${rowIndex}:${colIndex}`, value);
        }
        return { ...prev, cellEdits: newEdits };
      });
    },
    [result],
  );

  const handleRowDelete = useCallback((rowIndex: number) => {
    setEditState((prev) => {
      if (!prev) return prev;
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.add(rowIndex);
      return { ...prev, deletedRows: newDeleted };
    });
  }, []);

  const handleRowRestore = useCallback((rowIndex: number) => {
    setEditState((prev) => {
      if (!prev) return prev;
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.delete(rowIndex);
      return { ...prev, deletedRows: newDeleted };
    });
  }, []);

  // Common toolbar props
  const toolbarProps = {
    panelView,
    setPanelView,
    searchTerm,
    setSearchTerm,
    setViewMode,
    viewMode,
    hasExplain,
    isExecuting: !!isExecuting,
    isEditing,
    editableTable: !!editableTable && !vq,
    changeCount,
    isCommitting,
    editError,
    onEnterEdit: handleEnterEdit,
    onCommit: handleCommit,
    onDiscard: handleDiscard,
    onCancel: handleCancel,
    virtualQuery: vq,
  };

  if (panelView === "explain" && hasExplain) {
    return (
      <div className="flex h-full flex-col border-t border-border bg-card">
        <ResultsToolbar {...toolbarProps} result={result ?? null} columns={result?.columns ?? []} filteredRows={filteredRows} filteredCount={filteredRows.length} />
        <ExplainPanel plan={explainResult} />
      </div>
    );
  }

  if (panelView !== "history" && isExecuting && !result) {
    return (
      <div className="flex h-full flex-col">
        <ResultsToolbar {...toolbarProps} result={null} columns={[]} filteredRows={[]} filteredCount={0} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Executing query...</span>
        </div>
      </div>
    );
  }

  if (panelView === "history") {
    return (
      <div className="flex h-full flex-col border-t border-border bg-card">
        <ResultsToolbar {...toolbarProps} result={result ?? null} columns={result?.columns ?? []} filteredRows={filteredRows} filteredCount={filteredRows.length} />
        <QueryHistory />
      </div>
    );
  }

  if (panelView === "diff" && pinnedResult && result) {
    return (
      <div className="flex h-full flex-col border-t border-border bg-card">
        <ResultsToolbar {...toolbarProps} result={result} columns={result.columns} filteredRows={filteredRows} filteredCount={filteredRows.length} />
        <DiffView
          pinnedColumns={pinnedResult.columns}
          pinnedRows={pinnedResult.rows}
          currentColumns={result.columns}
          currentRows={filteredRows}
        />
      </div>
    );
  }

  if (panelView === "map" && result) {
    return (
      <div className="flex h-full flex-col border-t border-border bg-card">
        <ResultsToolbar {...toolbarProps} result={result} columns={result.columns} filteredRows={filteredRows} filteredCount={filteredRows.length} />
        <ResultsMap columns={result.columns} rows={filteredRows} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col">
        <ResultsToolbar {...toolbarProps} result={null} columns={[]} filteredRows={[]} filteredCount={0} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No data to display
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      <ResultsToolbar {...toolbarProps} result={result} columns={result.columns} filteredRows={filteredRows} filteredCount={filteredRows.length} />
      {editError && !isEditing && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/10 text-destructive text-xs border-b border-border">
          <XCircle className="h-3 w-3" />
          {editError}
          <button onClick={() => setEditError(null)} className="ml-auto hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {viewMode === "grid" ? (
        <ResultsGrid
          columns={result.columns}
          rows={filteredRows}
          isEditing={isEditing}
          cellEdits={editState?.cellEdits}
          deletedRows={editState?.deletedRows}
          onCellEdit={handleCellEdit}
          onRowDelete={handleRowDelete}
          onRowRestore={handleRowRestore}
          fkColumns={fkMap}
          onFKNavigate={handleFKNavigate}
          virtualQuery={vq}
          onPageNeeded={vq ? handlePageNeeded : undefined}
          gridRef={gridRef}
        />
      ) : (
        <ResultsRecord columns={result.columns} rows={filteredRows} />
      )}
    </div>
  );
}

interface ToolbarProps {
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  result: { rows: string[][]; time: number; capped?: boolean } | null;
  columns: string[];
  filteredRows: string[][];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredCount: number;
  setViewMode: (mode: "grid" | "record") => void;
  viewMode: "grid" | "record";
  hasExplain: boolean;
  isExecuting: boolean;
  isEditing: boolean;
  editableTable: boolean;
  changeCount: number;
  isCommitting: boolean;
  editError: string | null;
  onEnterEdit: () => void;
  onCommit: () => void;
  onDiscard: () => void;
  onCancel?: () => void;
  virtualQuery?: { queryId: string; totalRows: number; time: number; pageSize: number };
}

function ResultsToolbar(props: ToolbarProps) {
  const {
    panelView,
    setPanelView,
    result,
    columns,
    filteredRows,
    searchTerm,
    setSearchTerm,
    filteredCount,
    setViewMode,
    viewMode,
    hasExplain,
    isExecuting,
    isEditing,
    editableTable,
    changeCount,
    isCommitting,
    editError,
    onEnterEdit,
    onCommit,
    onDiscard,
    onCancel,
    virtualQuery,
  } = props;

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const pinnedResult = useUIStore((s) => s.pinnedResult);
  const pinResult = useUIStore((s) => s.pinResult);
  const clearPinnedResult = useUIStore((s) => s.clearPinnedResult);

  const handleExport = (format: ExportFormat) => {
    if (!result) return;
    exportResults(format, columns, filteredRows);
    setExportOpen(false);
  };

  const handleCopy = (format: ExportFormat) => {
    if (!result) return;
    void copyToClipboard(format, columns, filteredRows);
    setExportOpen(false);
  };

  return (
    <div className="flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Panel tabs — segment control */}
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          <button
            onClick={() => {
              setPanelView("grid");
              setViewMode("grid");
            }}
            className={`px-2 py-0.5 rounded-md text-xs font-mono transition-all duration-150 ${
              panelView !== "history" && viewMode === "grid"
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => {
              setPanelView("record");
              setViewMode("record");
            }}
            className={`px-2 py-0.5 rounded-md text-xs font-mono transition-all duration-150 ${
              panelView !== "history" && viewMode === "record"
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            disabled={!result?.rows.length || !!virtualQuery}
          >
            Record
          </button>
          {hasExplain && (
            <button
              onClick={() => setPanelView("explain")}
              className={`px-2 py-0.5 rounded-md text-xs font-mono transition-all duration-150 flex items-center gap-1 ${
                panelView === "explain"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3 w-3" />
              Explain
            </button>
          )}
          <button
            onClick={() => setPanelView("history")}
            className={`px-2 py-0.5 rounded-md text-xs font-mono transition-all duration-150 flex items-center gap-1 ${
              panelView === "history"
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3 w-3" />
            History
          </button>
          {result && hasGeometryColumn(columns, filteredRows) && (
            <button
              onClick={() => setPanelView("map")}
              className={`px-2 py-0.5 rounded-md text-xs font-mono transition-all duration-150 flex items-center gap-1 ${
                panelView === "map"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Map
            </button>
          )}
        </div>

        {/* Result stats */}
        {panelView !== "history" && result && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isExecuting ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-success" />
            )}
            <span>
              {virtualQuery
                ? `${virtualQuery.totalRows.toLocaleString()} rows (virtual)`
                : searchTerm
                  ? `${filteredCount.toLocaleString()} / ${result.rows.length.toLocaleString()} rows`
                  : `${result.rows.length.toLocaleString()} rows`}
              {result.capped && !virtualQuery && (
                <span className="text-warning ml-1">(capped at 500K)</span>
              )}
            </span>
            <span className="text-muted-foreground/50">&bull;</span>
            <Clock className="h-3 w-3" />
            <span>{result.time.toFixed(0)}ms</span>
            {isEditing && changeCount > 0 && (
              <>
                <span className="text-muted-foreground/50">&bull;</span>
                <span className="text-amber-500 font-medium">{changeCount} change{changeCount !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        )}

        {/* Stop button — visible while executing */}
        {isExecuting && onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Edit mode controls */}
        {isEditing ? (
          <>
            {editError && (
              <span className="text-xs text-destructive max-w-[200px] truncate" title={editError}>
                {editError}
              </span>
            )}
            <button
              onClick={onCommit}
              disabled={changeCount === 0 || isCommitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              {isCommitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Commit
            </button>
            <button
              onClick={onDiscard}
              disabled={isCommitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Discard
            </button>
          </>
        ) : (
          <>
            {/* Edit button */}
            {panelView !== "history" && editableTable && result && result.rows.length > 0 && (
              <button
                onClick={onEnterEdit}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Edit table data inline"
              >
                <Edit3 className="h-3 w-3" />
                Edit
              </button>
            )}

            {/* Pin / Diff */}
            {panelView !== "history" && result && result.rows.length > 0 && !virtualQuery && (
              <>
                {pinnedResult ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20">
                    <Pin className="h-3 w-3" />
                    <span>Pinned: {pinnedResult.label}</span>
                    <button
                      onClick={clearPinnedResult}
                      className="hover:text-destructive ml-1"
                      title="Clear pinned result"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      pinResult(
                        { columns, rows: filteredRows, time: result.time },
                        `${filteredRows.length} rows`,
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Pin current results for later diff comparison"
                  >
                    <Pin className="h-3 w-3" />
                    Pin
                  </button>
                )}
                {pinnedResult && (
                  <button
                    onClick={() => setPanelView("diff")}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                      panelView === "diff"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Diff className="h-3 w-3" />
                    Diff
                  </button>
                )}
              </>
            )}

            {/* Export dropdown */}
            {panelView !== "history" && result && result.rows.length > 0 && !virtualQuery && (
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
                {exportOpen && createPortal(
                  <>
                    <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setExportOpen(false)} />
                    <div
                      className="fixed w-52 rounded-md border border-border bg-popover shadow-md py-1"
                      style={{
                        zIndex: 9999,
                        top: (() => { const r = exportRef.current?.getBoundingClientRect(); return r ? r.bottom + 4 : 0; })(),
                        left: (() => { const r = exportRef.current?.getBoundingClientRect(); return r ? Math.max(0, r.right - 208) : 0; })(),
                      }}
                    >
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Download
                      </div>
                      {(["csv", "json", "sql", "markdown", "xml"] as ExportFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => handleExport(fmt)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors"
                        >
                          <Download className="h-3 w-3 text-muted-foreground" />
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                      <div className="border-t border-border my-1" />
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Copy to clipboard
                      </div>
                      {(["csv", "json", "sql", "markdown"] as ExportFormat[]).map((fmt) => (
                        <button
                          key={`copy-${fmt}`}
                          onClick={() => handleCopy(fmt)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}

            {/* Search */}
            {panelView !== "history" && result && !virtualQuery && (
              <div className="relative flex items-center">
                <Search className="absolute left-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 w-48 rounded border border-border bg-input pl-7 pr-7 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiffView({
  pinnedColumns,
  pinnedRows,
  currentColumns,
  currentRows,
}: {
  pinnedColumns: string[];
  pinnedRows: string[][];
  currentColumns: string[];
  currentRows: string[][];
}) {
  const [diffResult, setDiffResult] = useState<{
    added: string[][];
    removed: string[][];
    unchangedCount: number;
  } | null>(null);
  const [computing, setComputing] = useState(false);

  const colsMatch =
    pinnedColumns.length === currentColumns.length && pinnedColumns.every((c, i) => c === currentColumns[i]);

  // Compute diff in Rust backend for performance
  const prevKeyRef = useRef("");
  const diffKey = `${pinnedRows.length}:${currentRows.length}`;
  if (diffKey !== prevKeyRef.current && colsMatch) {
    prevKeyRef.current = diffKey;
    setComputing(true);
    setDiffResult(null);

    // Pack rows into the compact wire format for Rust
    const CELL_SEP = "\x1F";
    const ROW_SEP = "\x1E";
    const packRows = (columns: string[], rows: string[][]) => {
      const header = columns.join(CELL_SEP);
      if (rows.length === 0) return header;
      return header + ROW_SEP + rows.map((r) => r.join(CELL_SEP)).join(ROW_SEP);
    };

    const pinnedPacked = packRows(pinnedColumns, pinnedRows);
    const currentPacked = packRows(currentColumns, currentRows);

    invoke<[string, string, number]>("compute_diff", {
      pinned_packed: pinnedPacked,
      current_packed: currentPacked,
    }).then(([addedPacked, removedPacked, unchangedCount]) => {
      const unpackRows = (packed: string): string[][] => {
        if (!packed) return [];
        const parts = packed.split(ROW_SEP);
        // Skip header (index 0)
        return parts.slice(1).map((r) => r.split(CELL_SEP));
      };
      setDiffResult({
        added: unpackRows(addedPacked),
        removed: unpackRows(removedPacked),
        unchangedCount,
      });
      setComputing(false);
    }).catch(() => {
      // Fallback: compute in JS if Rust command fails
      const pinnedSet = new Set(pinnedRows.map((r) => r.join(CELL_SEP)));
      const currentSet = new Set(currentRows.map((r) => r.join(CELL_SEP)));
      setDiffResult({
        added: currentRows.filter((r) => !pinnedSet.has(r.join(CELL_SEP))),
        removed: pinnedRows.filter((r) => !currentSet.has(r.join(CELL_SEP))),
        unchangedCount: currentRows.filter((r) => pinnedSet.has(r.join(CELL_SEP))).length,
      });
      setComputing(false);
    });
  }

  if (!colsMatch) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2 p-4">
        <Diff className="h-8 w-8" />
        <div className="text-sm font-mono">Column structures differ</div>
        <div className="text-xs">Pinned: {pinnedColumns.join(", ")}</div>
        <div className="text-xs">Current: {currentColumns.join(", ")}</div>
      </div>
    );
  }

  if (computing || !diffResult) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Computing diff...</span>
      </div>
    );
  }

  const { added, removed, unchangedCount } = diffResult;

  return (
    <div className="flex-1 overflow-auto p-4 font-mono text-xs">
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1 text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> +{added.length} added
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive" /> -{removed.length} removed
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">={unchangedCount} unchanged</span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-2 py-1 text-left bg-secondary text-[10px] w-8" />
            {pinnedColumns.map((col) => (
              <th key={col} className="border border-border px-2 py-1 text-left bg-secondary text-[10px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {removed.map((row, i) => (
            <tr key={`r-${i}`} className="bg-destructive/10">
              <td className="border border-border px-2 py-0.5 text-destructive text-center">-</td>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-0.5 text-destructive">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {added.map((row, i) => (
            <tr key={`a-${i}`} className="bg-success/10">
              <td className="border border-border px-2 py-0.5 text-success text-center">+</td>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-0.5 text-success">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
