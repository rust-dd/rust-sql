import { cn } from "@/lib/utils";
import type { TableStatRow } from "./types";

interface TableStatsTabProps {
  tableStats: TableStatRow[];
}

export function TableStatsTab({ tableStats }: TableStatsTabProps) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] text-muted-foreground px-1">
        Cumulative stats since server start or last pg_stat_reset(). Source: pg_stat_user_tables
      </p>
      <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {["Schema", "Table", "Seq Scan", "Idx Scan", "Live Tuples", "Dead Tuples", "Inserts", "Updates", "Deletes", "Last Vacuum", "Last Analyze"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tableStats.map((row) => {
              const deadRatio = parseInt(row.liveTuples) > 0
                ? (parseInt(row.deadTuples) / parseInt(row.liveTuples)) * 100
                : 0;
              return (
                <tr key={`${row.schema}.${row.table}`} className="hover:bg-muted/30">
                  <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{row.schema}</td>
                  <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.table}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.seqScan).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.idxScan).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.liveTuples).toLocaleString()}</td>
                  <td className={cn("px-2 py-1 font-mono text-[11px]", deadRatio > 10 && "text-destructive font-medium")}>
                    {parseInt(row.deadTuples).toLocaleString()}
                    {deadRatio > 10 && <span className="ml-1 text-[9px]">({deadRatio.toFixed(0)}%)</span>}
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.inserts).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.updates).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{parseInt(row.deletes).toLocaleString()}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastVacuum === "never" ? "never" : new Date(row.lastVacuum).toLocaleDateString()}</td>
                  <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.lastAnalyze === "never" ? "never" : new Date(row.lastAnalyze).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {tableStats.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center font-mono text-xs text-muted-foreground">No table stats available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
