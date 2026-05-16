import { cn } from "@/lib/utils";
import type { ActivityRow } from "./types";

interface ActivityTabProps {
  activity: ActivityRow[];
}

export function ActivityTab({ activity }: ActivityTabProps) {
  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {["PID", "User", "State", "Duration", "Wait", "Backend", "Client", "Query"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {activity.map((row) => (
              <tr key={row.pid} className="hover:bg-muted/30">
                <td className="px-2 py-1 font-mono text-[11px]">{row.pid}</td>
                <td className="px-2 py-1 font-mono text-[11px]">{row.user}</td>
                <td className="px-2 py-1">
                  <span className={cn(
                    "inline-block rounded px-1.5 py-0.5 font-mono text-[10px]",
                    row.state === "active" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                    row.state === "idle" && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                    row.state === "idle in transaction" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                  )}>
                    {row.state}
                  </span>
                </td>
                <td className="px-2 py-1 font-mono text-[11px]">{parseFloat(row.durationSec).toFixed(1)}s</td>
                <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.waitEvent || "-"}</td>
                <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.backendType}</td>
                <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.clientAddr}</td>
                <td className="max-w-[300px] truncate px-2 py-1 font-mono text-[10px] text-muted-foreground" title={row.query}>{row.query}</td>
              </tr>
            ))}
            {activity.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center font-mono text-xs text-muted-foreground">No active connections</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
