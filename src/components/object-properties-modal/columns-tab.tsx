import { Columns3, Key } from "lucide-react";
import { LoadingPlaceholder } from "./shared";

export function ColumnsContent({
  cols,
  pkCols,
}: {
  cols?: import("@/types").ColumnDetail[];
  pkCols: Set<string>;
}) {
  if (!cols) {
    return <LoadingPlaceholder />;
  }

  return (
    <div className="pt-3">
      <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="bg-muted/30 border-b border-border/30">
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-6">
                #
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-8"></th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Name
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Type
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Nullable
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => (
              <tr
                key={c.name}
                className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground/30">{i + 1}</td>
                <td className="px-3 py-1.5">
                  {pkCols.has(c.name) ? (
                    <Key className="h-3 w-3 text-warning" />
                  ) : (
                    <Columns3 className="h-3 w-3 text-muted-foreground/20" />
                  )}
                </td>
                <td className="px-3 py-1.5 text-foreground font-medium">{c.name}</td>
                <td className="px-3 py-1.5">
                  <span className="text-primary/70 bg-primary/[0.06] px-1.5 py-0.5 rounded">
                    {c.dataType}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  {c.nullable ? (
                    <span className="text-muted-foreground/40">YES</span>
                  ) : (
                    <span className="text-orange-400/80 text-[10px] font-semibold">NOT NULL</span>
                  )}
                </td>
                <td
                  className="px-3 py-1.5 text-muted-foreground/60 max-w-[150px] truncate"
                  title={c.defaultValue ?? ""}
                >
                  {c.defaultValue ?? <span className="text-muted-foreground/20">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
