import { useState, useMemo } from "react";
import { useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { CheckCircle2, Clock, History, Loader2, Search, X } from "lucide-react";
import { ResultsGrid } from "./results-grid";
import { ResultsRecord } from "./results-record";
import { QueryHistory } from "./query-history";

type PanelView = "grid" | "record" | "history";

export function ResultsPanel() {
  const activeTab = useActiveTab();
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const [panelView, setPanelView] = useState<PanelView>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const result = activeTab?.result;
  const isExecuting = activeTab?.isExecuting;

  const filteredRows = useMemo(() => {
    if (!result || !searchTerm.trim()) return result?.rows ?? [];
    const term = searchTerm.toLowerCase();
    return result.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(term)),
    );
  }, [result, searchTerm]);

  if (panelView !== "history" && isExecuting) {
    return (
      <div className="flex h-full flex-col">
        <ResultsToolbar
          panelView={panelView}
          setPanelView={setPanelView}
          result={null}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={0}
          setViewMode={setViewMode}
          viewMode={viewMode}
        />
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
        <ResultsToolbar
          panelView={panelView}
          setPanelView={setPanelView}
          result={result ?? null}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={filteredRows.length}
          setViewMode={setViewMode}
          viewMode={viewMode}
        />
        <QueryHistory />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col">
        <ResultsToolbar
          panelView={panelView}
          setPanelView={setPanelView}
          result={null}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filteredCount={0}
          setViewMode={setViewMode}
          viewMode={viewMode}
        />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No data to display
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      <ResultsToolbar
        panelView={panelView}
        setPanelView={setPanelView}
        result={result}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredCount={filteredRows.length}
        setViewMode={setViewMode}
        viewMode={viewMode}
      />
      {viewMode === "grid" ? (
        <ResultsGrid columns={result.columns} rows={filteredRows} />
      ) : (
        <ResultsRecord columns={result.columns} rows={filteredRows} />
      )}
    </div>
  );
}

function ResultsToolbar({
  panelView,
  setPanelView,
  result,
  searchTerm,
  setSearchTerm,
  filteredCount,
  setViewMode,
  viewMode,
}: {
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  result: { rows: string[][]; time: number } | null;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredCount: number;
  setViewMode: (mode: "grid" | "record") => void;
  viewMode: "grid" | "record";
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Panel tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setPanelView("grid"); setViewMode("grid"); }}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
              panelView !== "history" && viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => { setPanelView("record"); setViewMode("record"); }}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
              panelView !== "history" && viewMode === "record"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            disabled={!result?.rows.length}
          >
            Record
          </button>
          <button
            onClick={() => setPanelView("history")}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors flex items-center gap-1 ${
              panelView === "history"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <History className="h-3 w-3" />
            History
          </button>
        </div>

        {/* Result stats */}
        {panelView !== "history" && result && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>
              {searchTerm
                ? `${filteredCount.toLocaleString()} / ${result.rows.length.toLocaleString()}`
                : result.rows.length.toLocaleString()}{" "}
              rows
            </span>
            <span className="text-muted-foreground/50">&bull;</span>
            <Clock className="h-3 w-3" />
            <span>{result.time.toFixed(0)}ms</span>
          </div>
        )}
      </div>

      {/* Search - only show for grid/record */}
      {panelView !== "history" && result && (
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
    </div>
  );
}
