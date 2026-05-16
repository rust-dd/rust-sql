import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/stores/history-store";

interface HistoryTabProps {
  slowQueries: HistoryEntry[];
}

export function HistoryTab({ slowQueries }: HistoryTabProps) {
  return (
    <div className="space-y-3">
      {/* Slow queries */}
      <div className="rounded-md border">
        <div className="border-b px-3 py-2">
          <span className="font-mono text-xs font-semibold">Slowest Queries (Session)</span>
        </div>
        <div className="divide-y">
          {slowQueries.map((q) => (
            <div key={q.id} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    q.success ? "text-muted-foreground" : "text-destructive",
                  )}
                >
                  {new Date(q.timestamp).toLocaleTimeString()} -{" "}
                  {q.success ? `${q.rowCount} rows` : "FAILED"}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] font-medium",
                    q.executionTime > 1000 && "text-destructive",
                  )}
                >
                  {q.executionTime.toFixed(1)}ms
                </span>
              </div>
              <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] text-foreground">
                {q.sql.slice(0, 200)}
                {q.sql.length > 200 ? "..." : ""}
              </pre>
              {q.error && (
                <div className="mt-1 font-mono text-[10px] text-destructive">{q.error}</div>
              )}
            </div>
          ))}
          {slowQueries.length === 0 && (
            <div className="py-6 text-center font-mono text-xs text-muted-foreground">
              No queries executed yet in this session
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
