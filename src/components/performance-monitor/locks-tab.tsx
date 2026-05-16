import { cn } from "@/lib/utils";
import type { LockRow } from "./types";

interface LocksTabProps {
  locks: LockRow[];
  waitingLocks: LockRow[];
}

export function LocksTab({ locks, waitingLocks }: LocksTabProps) {
  return (
    <div className="space-y-2">
      {waitingLocks.length > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 dark:border-yellow-700 dark:bg-yellow-900/20">
          <span className="font-mono text-xs font-semibold text-yellow-700 dark:text-yellow-400">
            {waitingLocks.length} lock{waitingLocks.length !== 1 ? "s" : ""} waiting to be granted
          </span>
        </div>
      )}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {["PID", "User", "Mode", "Lock Type", "Status", "Relation", "Duration", "Query"].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {locks.map((row, idx) => (
                <tr
                  key={`${row.pid}-${row.mode}-${row.locktype}-${idx}`}
                  className={cn(
                    "hover:bg-muted/30",
                    row.status === "waiting" && "bg-yellow-50/50 dark:bg-yellow-900/10"
                  )}
                >
                  <td className="px-2 py-1 font-mono text-[11px]">{row.pid}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{row.user}</td>
                  <td className="px-2 py-1 font-mono text-[10px]">{row.mode}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.locktype}</td>
                  <td className="px-2 py-1">
                    <span className={cn(
                      "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                      row.status === "granted" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      row.status === "waiting" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                    )}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px]">{row.relation || "-"}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseFloat(row.duration || "0").toFixed(1)}s</td>
                  <td className="max-w-[300px] truncate px-2 py-1 font-mono text-[10px] text-muted-foreground" title={row.query}>{row.query}</td>
                </tr>
              ))}
              {locks.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center font-mono text-xs text-muted-foreground">No active locks</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
