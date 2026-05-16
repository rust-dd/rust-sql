import type {
  DraftUniqueConstraint,
  StructureEditorState,
} from "@/lib/alter-table-sql";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { uid } from "./initialization";

export function UniqueSection({
  draft,
  setDraft,
  activeColNames,
  tableName,
}: {
  draft: StructureEditorState;
  setDraft: React.Dispatch<React.SetStateAction<StructureEditorState>>;
  activeColNames: string[];
  tableName: string;
}) {
  return (
    <div className="space-y-3 py-1">
      {draft.uniqueConstraints
        .filter((uc) => uc._status !== "removed")
        .map((uc) => (
          <div
            key={uc._id}
            className={cn(
              "rounded-xl border px-3.5 py-3 space-y-2",
              uc._status === "added"
                ? "border-green-500/20 bg-green-500/5"
                : "border-border/25 bg-muted/10",
            )}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={uc.constraintName}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    uniqueConstraints: prev.uniqueConstraints.map((u) =>
                      u._id === uc._id
                        ? { ...u, constraintName: e.target.value }
                        : u,
                    ),
                  }));
                }}
                className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border/30 rounded-md outline-none focus:border-primary/50"
                placeholder="Constraint name"
              />
              <button
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    uniqueConstraints: prev.uniqueConstraints
                      .map((u) =>
                        u._id === uc._id
                          ? u._status === "added"
                            ? null
                            : { ...u, _status: "removed" as const }
                          : u,
                      )
                      .filter(Boolean) as DraftUniqueConstraint[],
                  }));
                }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
              Columns
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeColNames.map((colName) => {
                const selected = uc.columns.includes(colName);
                return (
                  <button
                    key={colName}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        uniqueConstraints: prev.uniqueConstraints.map(
                          (u) => {
                            if (u._id !== uc._id) return u;
                            const newCols = selected
                              ? u.columns.filter((c) => c !== colName)
                              : [...u.columns, colName];
                            return { ...u, columns: newCols };
                          },
                        ),
                      }));
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-mono rounded-md border transition-all",
                      selected
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "border-border/20 text-muted-foreground hover:border-border/40",
                    )}
                  >
                    {colName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      {draft.uniqueConstraints
        .filter((uc) => uc._status === "removed")
        .map((uc) => (
          <div
            key={uc._id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 opacity-60"
          >
            <span className="text-xs font-mono line-through flex-1">
              {uc.constraintName}
            </span>
            <button
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  uniqueConstraints: prev.uniqueConstraints.map((u) =>
                    u._id === uc._id
                      ? { ...u, _status: "existing" as const }
                      : u,
                  ),
                }))
              }
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Restore
            </button>
          </div>
        ))}
      <button
        onClick={() => {
          setDraft((prev) => ({
            ...prev,
            uniqueConstraints: [
              ...prev.uniqueConstraints,
              {
                _id: uid(),
                _status: "added",
                constraintName: `${tableName}_unique_${prev.uniqueConstraints.length + 1}`,
                columns: [],
              },
            ],
          }));
        }}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
      >
        <Plus className="h-3.5 w-3.5" /> Add Unique Constraint
      </button>
    </div>
  );
}
