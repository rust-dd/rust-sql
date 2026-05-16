import { cn } from "@/lib/utils";
import type { BloatRow } from "./types";

interface BloatTabProps {
  bloat: BloatRow[];
  tablesNeedingVacuum: BloatRow[];
}

export function BloatTab({ bloat, tablesNeedingVacuum }: BloatTabProps) {
  return (
    <div className="space-y-2">
      {tablesNeedingVacuum.length > 0 && (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 dark:border-orange-700 dark:bg-orange-900/20">
          <span className="font-mono text-xs font-semibold text-orange-700 dark:text-orange-400">
            {tablesNeedingVacuum.length} table{tablesNeedingVacuum.length !== 1 ? "s" : ""} with{" "}
            {">"} 10% bloat -- consider running VACUUM
          </span>
        </div>
      )}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {[
                  "Schema",
                  "Table",
                  "Live Tuples",
                  "Dead Tuples",
                  "Bloat %",
                  "Total Size",
                  "Last Vacuum",
                  "Last Analyze",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {bloat.map((row, idx) => {
                const pct = parseFloat(row.bloatPct) || 0;
                const barColor =
                  pct > 30 ? "bg-red-500" : pct > 10 ? "bg-yellow-500" : "bg-green-500";
                return (
                  <tr key={`${row.schema}.${row.table}-${idx}`} className="hover:bg-muted/30">
                    <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {row.schema}
                    </td>
                    <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.table}</td>
                    <td className="px-2 py-1 font-mono text-[11px]">
                      {parseInt(row.liveTuples, 10).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 font-mono text-[11px]">
                      {parseInt(row.deadTuples, 10).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", barColor)}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            pct > 30 && "text-red-600 dark:text-red-400 font-medium",
                            pct > 10 && pct <= 30 && "text-yellow-600 dark:text-yellow-400",
                            pct <= 10 && "text-muted-foreground",
                          )}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1 font-mono text-[11px]">{row.totalSize}</td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {row.lastVacuum === "never"
                        ? "never"
                        : new Date(row.lastVacuum).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {row.lastAnalyze === "never"
                        ? "never"
                        : new Date(row.lastAnalyze).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {bloat.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 text-center font-mono text-xs text-muted-foreground"
                  >
                    No table bloat data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
