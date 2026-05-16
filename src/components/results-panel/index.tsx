import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useProjectStore } from "@/stores/project-store";
import { DriverFactory } from "@/lib/database-driver";
import { Loader2, X, XCircle } from "lucide-react";
import { ResultsGrid } from "../results-grid";
import { ResultsRecord } from "../results-record";
import { QueryHistory } from "../query-history";
import { ExplainPanel } from "../explain-panel";
import { ResultsMap } from "../results-map";
import { ResultsToolbar } from "./toolbar";
import { DiffView } from "./diff-view";
import { useVirtualPaging } from "./use-virtual-paging";
import { useEditMode } from "./use-edit-mode";
import type { PanelView } from "./types";

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
  const { gridRef, handlePageNeeded, handleViewportRowChange, restoreRowIndex } = useVirtualPaging({
    vq,
    projectId: activeTab?.projectId,
  });

  // Edit mode
  const {
    isEditing,
    editState,
    editError,
    setEditError,
    isCommitting,
    pendingDeleteCount,
    editableTable,
    fkMap,
    handleFKNavigate,
    handleEnterEdit,
    handleDiscard,
    handleCommit,
    handleDeleteRows,
    handleConfirmDelete,
    handleCancelDelete,
    handleCellEdit,
    handleRowDelete,
    handleRowRestore,
  } = useEditMode({
    projectId: activeTab?.projectId,
    editorValue: activeTab?.editorValue,
    result,
  });

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
    editState,
    editableTable: !!editableTable && !vq,
    isCommitting,
    editError,
    onEnterEdit: handleEnterEdit,
    onCommit: handleCommit,
    onDeleteRows: handleDeleteRows,
    onConfirmDelete: handleConfirmDelete,
    onCancelDelete: handleCancelDelete,
    pendingDeleteCount,
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
          key={activeTab?.id ?? "results-grid"}
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
          onViewportRowChange={vq ? handleViewportRowChange : undefined}
          restoreRowIndex={vq ? restoreRowIndex : undefined}
          viewportKey={vq?.queryId}
          gridRef={gridRef}
        />
      ) : (
        <ResultsRecord columns={result.columns} rows={filteredRows} />
      )}
    </div>
  );
}
