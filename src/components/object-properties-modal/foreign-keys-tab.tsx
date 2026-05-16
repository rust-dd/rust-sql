import { ArrowRight } from "lucide-react";
import { PropertySection } from "./shared";
import type { FKInfo } from "./types";

export function ForeignKeysContent({
  outgoingFKs,
  incomingFKs,
  openTab,
  projectId,
  onOpenChange,
}: {
  outgoingFKs: FKInfo[];
  incomingFKs: FKInfo[];
  openTab: (projectId?: string, sql?: string) => void;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (outgoingFKs.length === 0 && incomingFKs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
        No foreign key relationships found.
      </div>
    );
  }

  return (
    <div className="space-y-4 py-3">
      {outgoingFKs.length > 0 && (
        <PropertySection
          title="Outgoing (this table references)"
          icon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Constraint
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Column
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    References
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON DELETE
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON UPDATE
                  </th>
                </tr>
              </thead>
              <tbody>
                {outgoingFKs.map((fk, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                  >
                    <td className="px-2 py-1.5 text-foreground">
                      {fk.constraintName}
                    </td>
                    <td className="px-2 py-1.5 text-primary/80">
                      {fk.sourceColumn}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(
                            projectId,
                            `SELECT * FROM "${fk.targetSchema}"."${fk.targetTable}" LIMIT 100;`,
                          );
                          onOpenChange(false);
                        }}
                      >
                        {fk.targetSchema}.{fk.targetTable}.{fk.targetColumn}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onDelete}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onUpdate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PropertySection>
      )}

      {incomingFKs.length > 0 && (
        <PropertySection
          title="Incoming (referenced by)"
          icon={<ArrowRight className="h-3.5 w-3.5 rotate-180" />}
        >
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Constraint
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    From Table
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    Column
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-widest">
                    ON DELETE
                  </th>
                </tr>
              </thead>
              <tbody>
                {incomingFKs.map((fk, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/15 hover:bg-primary/[0.04] transition-colors"
                  >
                    <td className="px-2 py-1.5 text-foreground">
                      {fk.constraintName}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          openTab(
                            projectId,
                            `SELECT * FROM "${fk.sourceSchema}"."${fk.sourceTable}" LIMIT 100;`,
                          );
                          onOpenChange(false);
                        }}
                      >
                        {fk.sourceSchema}.{fk.sourceTable}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-primary/80">
                      {fk.sourceColumn} &rarr; {fk.targetColumn}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {fk.onDelete}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PropertySection>
      )}
    </div>
  );
}
