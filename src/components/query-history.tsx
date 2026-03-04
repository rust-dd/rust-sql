import { useHistoryStore, type HistoryEntry } from "@/stores/history-store";
import { useTabStore } from "@/stores/tab-store";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Trash2, Clock, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

export function QueryHistory() {
  const entries = useHistoryStore((s) => s.entries);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const selectedTabIndex = useTabStore((s) => s.selectedTabIndex);
  const updateContent = useTabStore((s) => s.updateContent);

  const restoreQuery = (sql: string) => {
    updateContent(selectedTabIndex, sql);
  };

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No query history yet
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 flex-shrink-0">
        <span className="font-mono text-xs font-semibold text-foreground">
          HISTORY ({entries.length})
        </span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={clearHistory}>
          <Trash2 className="h-3 w-3" />
          Clear
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {entries.map((entry) => (
          <HistoryRow key={entry.id} entry={entry} onRestore={restoreQuery} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  onRestore,
}: {
  entry: HistoryEntry;
  onRestore: (sql: string) => void;
}) {
  const time = new Date(entry.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const sqlPreview = entry.sql.length > 120 ? entry.sql.slice(0, 120) + "..." : entry.sql;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border px-4 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer",
      )}
      onClick={() => onRestore(entry.sql)}
    >
      <div className="mt-0.5 flex-shrink-0">
        {entry.success ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-foreground whitespace-pre-wrap break-all leading-relaxed">
          {sqlPreview}
        </div>
        {entry.error && (
          <div className="mt-1 text-xs text-destructive font-mono truncate">
            {entry.error}
          </div>
        )}
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeStr}
          </span>
          <span>{entry.database}</span>
          {entry.success && (
            <>
              <span>{entry.rowCount.toLocaleString()} rows</span>
              <span>{entry.executionTime.toFixed(0)}ms</span>
            </>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRestore(entry.sql);
        }}
        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        title="Restore to editor"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
