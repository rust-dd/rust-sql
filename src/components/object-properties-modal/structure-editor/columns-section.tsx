import type { DraftColumn, StructureEditorState } from "@/lib/alter-table-sql";
import { PG_COMMON_TYPES } from "@/lib/alter-table-sql";
import { cn } from "@/lib/utils";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { uid } from "./initialization";

export function ColumnsSection({
  draft,
  setDraft,
}: {
  draft: StructureEditorState;
  setDraft: React.Dispatch<React.SetStateAction<StructureEditorState>>;
}) {
  const updateColumn = (id: string, updates: Partial<DraftColumn>) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => {
        if (c._id !== id) return c;
        const updated = { ...c, ...updates };
        // Mark as modified if it was existing and something changed
        if (c._status === "existing") {
          const changed =
            updated.name !== c.originalName ||
            updated.dataType !== c.originalDataType ||
            updated.nullable !== c.originalNullable ||
            updated.defaultValue !== c.originalDefault;
          updated._status = changed ? "modified" : "existing";
        }
        return updated;
      }),
    }));
  };

  const addColumn = () => {
    setDraft((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          _id: uid(),
          _status: "added",
          name: `new_column_${prev.columns.length + 1}`,
          dataType: "text",
          nullable: true,
          defaultValue: null,
        },
      ],
    }));
  };

  const removeColumn = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns
        .map((c) =>
          c._id === id
            ? c._status === "added"
              ? null
              : { ...c, _status: "removed" as const }
            : c,
        )
        .filter(Boolean) as DraftColumn[],
    }));
  };

  const restoreColumn = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      columns: prev.columns.map((c) =>
        c._id === id ? { ...c, _status: "existing" as const } : c,
      ),
    }));
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_140px_70px_1fr_36px] gap-1.5 px-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
        <span>Name</span>
        <span>Type</span>
        <span>Nullable</span>
        <span>Default</span>
        <span />
      </div>
      {draft.columns.map((col) => (
        <div
          key={col._id}
          className={cn(
            "grid grid-cols-[1fr_140px_70px_1fr_36px] gap-1.5 items-center px-1 py-1 rounded-lg border transition-all",
            col._status === "added" &&
              "border-l-2 border-l-green-500 border-border/20 bg-green-500/5",
            col._status === "modified" &&
              "border-l-2 border-l-amber-500 border-border/20 bg-amber-500/5",
            col._status === "removed" &&
              "border-l-2 border-l-red-500 border-border/20 bg-red-500/5 opacity-50",
            col._status === "existing" && "border-border/20",
          )}
        >
          <input
            type="text"
            value={col.name}
            disabled={col._status === "removed"}
            onChange={(e) =>
              updateColumn(col._id, { name: e.target.value })
            }
            className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
          />
          <input
            type="text"
            value={col.dataType}
            disabled={col._status === "removed"}
            onChange={(e) =>
              updateColumn(col._id, { dataType: e.target.value })
            }
            list="pg-types"
            className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 disabled:opacity-40"
          />
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={col.nullable}
              disabled={col._status === "removed"}
              onChange={(e) =>
                updateColumn(col._id, { nullable: e.target.checked })
              }
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
          </div>
          <input
            type="text"
            value={col.defaultValue ?? ""}
            disabled={col._status === "removed"}
            onChange={(e) =>
              updateColumn(col._id, {
                defaultValue: e.target.value || null,
              })
            }
            placeholder="NULL"
            className="h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 disabled:opacity-40"
          />
          <div className="flex justify-center">
            {col._status === "removed" ? (
              <button
                onClick={() => restoreColumn(col._id)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                title="Restore"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => removeColumn(col._id)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={addColumn}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
      >
        <Plus className="h-3.5 w-3.5" /> Add Column
      </button>
      <datalist id="pg-types">
        {PG_COMMON_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
