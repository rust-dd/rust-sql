import type { DraftForeignKey } from "@/lib/alter-table-sql";
import { FK_ACTIONS } from "@/lib/alter-table-sql";
import { DriverFactory } from "@/lib/database-driver";
import { cn } from "@/lib/utils";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function FKCard({
  fk,
  activeColNames,
  availableSchemas,
  getTablesForSchema,
  loadTables,
  projectId,
  getDriver,
  onChange,
  onRemove,
}: {
  fk: DraftForeignKey;
  activeColNames: string[];
  availableSchemas: string[];
  getTablesForSchema: (schema: string) => string[];
  loadTables: (projectId: string, schema: string) => Promise<void>;
  projectId: string;
  getDriver: () => ReturnType<typeof DriverFactory.getDriver> | null;
  onChange: (updates: Partial<DraftForeignKey>) => void;
  onRemove: () => void;
}) {
  const [targetCols, setTargetCols] = useState<string[]>([]);

  // Load target table columns when target changes
  useEffect(() => {
    if (!fk.targetTable || !fk.targetSchema) {
      setTargetCols([]);
      return;
    }
    const driver = getDriver();
    if (!driver) return;
    driver
      .loadColumns(projectId, fk.targetSchema, fk.targetTable)
      .then(setTargetCols)
      .catch(() => setTargetCols([]));
  }, [fk.targetSchema, fk.targetTable, projectId, getDriver]);

  // Ensure tables are loaded for the selected schema
  useEffect(() => {
    if (fk.targetSchema) {
      loadTables(projectId, fk.targetSchema).catch(() => {});
    }
  }, [fk.targetSchema, projectId, loadTables]);

  const targetTableNames = getTablesForSchema(fk.targetSchema);

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 space-y-2.5",
        fk._status === "added"
          ? "border-green-500/20 bg-green-500/5"
          : "border-border/25 bg-muted/10",
      )}
    >
      {/* Name + delete */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={fk.constraintName}
          onChange={(e) => onChange({ constraintName: e.target.value })}
          className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          placeholder="Constraint name"
        />
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Target: schema + table */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            Target Schema
          </div>
          <select
            value={fk.targetSchema}
            onChange={(e) =>
              onChange({
                targetSchema: e.target.value,
                targetTable: "",
                targetColumns: [],
              })
            }
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {availableSchemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            Target Table
          </div>
          <select
            value={fk.targetTable}
            onChange={(e) =>
              onChange({ targetTable: e.target.value, targetColumns: [] })
            }
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            <option value="">Select table...</option>
            {targetTableNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column mapping: source → target (paired rows) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Column Mapping</div>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_20px_1fr_28px] gap-1.5 text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold px-0.5">
            <span>Source</span>
            <span />
            <span>Target</span>
            <span />
          </div>
          {fk.sourceColumns.map((srcCol, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_20px_1fr_28px] gap-1.5 items-center">
              <select
                value={srcCol}
                onChange={(e) => {
                  const newSrc = [...fk.sourceColumns];
                  newSrc[idx] = e.target.value;
                  onChange({ sourceColumns: newSrc });
                }}
                className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
              >
                <option value="">Select...</option>
                {activeColNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 mx-auto" />
              <select
                value={fk.targetColumns[idx] ?? ""}
                onChange={(e) => {
                  const newTgt = [...fk.targetColumns];
                  newTgt[idx] = e.target.value;
                  onChange({ targetColumns: newTgt });
                }}
                disabled={!fk.targetTable || targetCols.length === 0}
                className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
              >
                <option value="">Select...</option>
                {targetCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const newSrc = fk.sourceColumns.filter((_, i) => i !== idx);
                  const newTgt = fk.targetColumns.filter((_, i) => i !== idx);
                  onChange({ sourceColumns: newSrc, targetColumns: newTgt });
                }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive mx-auto"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              onChange({
                sourceColumns: [...fk.sourceColumns, ""],
                targetColumns: [...fk.targetColumns, ""],
              });
            }}
            className="flex items-center gap-1 px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add column pair
          </button>
        </div>
      </div>

      {/* ON UPDATE / ON DELETE */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            On Update
          </div>
          <select
            value={fk.onUpdate}
            onChange={(e) => onChange({ onUpdate: e.target.value })}
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {FK_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-1">
            On Delete
          </div>
          <select
            value={fk.onDelete}
            onChange={(e) => onChange({ onDelete: e.target.value })}
            className="w-full h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
          >
            {FK_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
