import { Key } from "lucide-react";
import type { StructureEditorState } from "@/lib/alter-table-sql";
import { cn } from "@/lib/utils";

export function PkSection({
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
      <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1">
        Select columns for primary key
      </div>
      <div className="space-y-1">
        {activeColNames.map((colName) => {
          const isInPK =
            draft.primaryKey?.columns.includes(colName) && draft.primaryKey._status !== "removed";
          return (
            <label
              key={colName}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/20 cursor-pointer transition-all",
                isInPK ? "bg-primary/5 border-primary/20" : "hover:bg-muted/20",
              )}
            >
              <input
                type="checkbox"
                checked={!!isInPK}
                onChange={() => {
                  setDraft((prev) => {
                    const currentCols =
                      prev.primaryKey?._status !== "removed"
                        ? (prev.primaryKey?.columns ?? [])
                        : [];
                    let newCols: string[];
                    if (currentCols.includes(colName)) {
                      newCols = currentCols.filter((c) => c !== colName);
                    } else {
                      newCols = [...currentCols, colName];
                    }
                    if (newCols.length === 0) {
                      if (prev.primaryKey?.originalColumns) {
                        return {
                          ...prev,
                          primaryKey: {
                            ...prev.primaryKey,
                            _status: "removed",
                            columns: [],
                          },
                        };
                      }
                      return { ...prev, primaryKey: null };
                    }
                    const existingPK = prev.primaryKey;
                    const wasExisting = existingPK?.originalColumns !== undefined;
                    const isSameAsOriginal =
                      wasExisting &&
                      JSON.stringify(newCols.sort()) ===
                        JSON.stringify([...(existingPK?.originalColumns ?? [])].sort());
                    return {
                      ...prev,
                      primaryKey: {
                        constraintName: existingPK?.constraintName ?? `${tableName}_pkey`,
                        columns: newCols,
                        _status: isSameAsOriginal ? "existing" : wasExisting ? "modified" : "added",
                        originalColumns: existingPK?.originalColumns,
                      },
                    };
                  });
                }}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span className="text-xs font-mono">{colName}</span>
              {isInPK && <Key className="h-3 w-3 text-primary ml-auto" />}
            </label>
          );
        })}
      </div>
      {draft.primaryKey &&
        draft.primaryKey._status !== "removed" &&
        draft.primaryKey.columns.length > 0 && (
          <div className="text-[10px] text-muted-foreground px-1">
            Constraint:{" "}
            <span className="font-mono text-foreground">{draft.primaryKey.constraintName}</span>
            {" — "}({draft.primaryKey.columns.join(", ")})
          </div>
        )}
    </div>
  );
}
