import { cn } from "@/lib/utils";
import type { IndexUsageRow } from "./types";

interface IndexesTabProps {
  indexUsage: IndexUsageRow[];
  unusedIndexCount: number;
}

export function IndexesTab({ indexUsage, unusedIndexCount }: IndexesTabProps) {
  return (
    <div className="space-y-2">
      {unusedIndexCount > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/20">
          <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
            {unusedIndexCount} unused index{unusedIndexCount !== 1 ? "es" : ""} found -- consider
            removing to save space and improve write performance
          </span>
        </div>
      )}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Schema", "Table", "Index", "Size", "Scans", "Status", "Definition"].map((h) => (
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
              {indexUsage.map((row, idx) => (
                <tr
                  key={`${row.schema}.${row.table}.${row.index}-${idx}`}
                  className="hover:bg-muted/30"
                >
                  <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {row.schema}
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px] font-medium">{row.table}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{row.index}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">{row.size}</td>
                  <td className="px-2 py-1 font-mono text-[11px]">
                    {parseInt(row.scans, 10).toLocaleString()}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 font-mono text-[10px]",
                        row.status === "unused" &&
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        row.status === "rarely_used" &&
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        row.status === "active" &&
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      )}
                    >
                      {row.status === "rarely_used" ? "rarely used" : row.status}
                    </span>
                  </td>
                  <td
                    className="max-w-[400px] truncate px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    title={row.definition}
                  >
                    {row.definition}
                  </td>
                </tr>
              ))}
              {indexUsage.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center font-mono text-xs text-muted-foreground"
                  >
                    No non-primary indexes found
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
