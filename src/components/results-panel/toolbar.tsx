import {
  CheckCircle2,
  Clock,
  Diff,
  Edit3,
  GitBranch,
  History,
  Loader2,
  Pin,
  Search,
  Square,
  X,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { hasGeometryColumn } from "../results-map";
import { ToolbarExport } from "./toolbar-export";
import { ToolbarEdit } from "./toolbar-edit";
import type { ToolbarProps } from "./types";

export function ResultsToolbar(props: ToolbarProps) {
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
    editState,
    editableTable,
    isCommitting,
    editError,
    onEnterEdit,
    onCommit,
    onDeleteRows,
    onConfirmDelete,
    onCancelDelete,
    pendingDeleteCount,
    onDiscard,
    onCancel,
    virtualQuery,
  } = props;

  const pinnedResult = useUIStore((s) => s.pinnedResult);
  const pinResult = useUIStore((s) => s.pinResult);
  const clearPinnedResult = useUIStore((s) => s.clearPinnedResult);

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
            {isEditing && editState?.cellEdits.size ? (
              <>
                <span className="text-muted-foreground/50">&bull;</span>
                <span className="text-amber-500 font-medium">{editState.cellEdits.size} edit{editState.cellEdits.size !== 1 ? "s" : ""}</span>
              </>
            ) : null}
            {isEditing && editState?.deletedRows.size ? (
              <>
                <span className="text-muted-foreground/50">&bull;</span>
                <span className="text-destructive font-medium">{editState.deletedRows.size} delete{editState.deletedRows.size !== 1 ? "s" : ""}</span>
              </>
            ) : null}
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
          <ToolbarEdit
            editState={editState}
            editError={editError}
            isCommitting={isCommitting}
            pendingDeleteCount={pendingDeleteCount}
            onCommit={onCommit}
            onDeleteRows={onDeleteRows}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            onDiscard={onDiscard}
          />
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
                    onClick={() => setPanelView(panelView === "diff" ? "grid" : "diff")}
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
              <ToolbarExport columns={columns} filteredRows={filteredRows} hasResult={!!result} />
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
