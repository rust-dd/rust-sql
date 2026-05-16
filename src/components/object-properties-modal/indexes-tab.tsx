import { Key, Shield } from "lucide-react";
import { LoadingPlaceholder } from "./shared";

export function IndexesContent({
  idxs,
}: {
  idxs?: import("@/types").IndexDetail[];
}) {
  if (!idxs) {
    return <LoadingPlaceholder />;
  }

  if (idxs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <Key className="h-6 w-6 text-muted-foreground/30" />
        <span className="text-xs font-mono">No indexes found</span>
      </div>
    );
  }

  const grouped = new Map<string, import("@/types").IndexDetail[]>();
  for (const idx of idxs) {
    if (!grouped.has(idx.indexName)) grouped.set(idx.indexName, []);
    grouped.get(idx.indexName)!.push(idx);
  }

  return (
    <div className="pt-3">
      <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="bg-muted/30 border-b border-border/30">
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest w-8"></th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Index Name
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Columns
              </th>
              <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([idxName, entries]) => {
              const f = entries[0];
              return (
                <tr
                  key={idxName}
                  className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                >
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <Key className="h-3 w-3 text-warning" />
                    ) : f.isUnique ? (
                      <Shield className="h-3 w-3 text-blue-500" />
                    ) : (
                      <Key className="h-3 w-3 text-muted-foreground/25" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">
                    {idxName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground/70">
                    {entries.map((e) => e.columnName).join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {f.isPrimary ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                        PRIMARY KEY
                      </span>
                    ) : f.isUnique ? (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        UNIQUE
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30">
                        INDEX
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
