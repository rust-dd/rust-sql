import { Plus } from "lucide-react";
import type { DraftForeignKey, StructureEditorState } from "@/lib/alter-table-sql";
import type { DriverFactory } from "@/lib/database-driver";
import { FKCard } from "./fk-card";
import { uid } from "./initialization";

export function FkeysSection({
  draft,
  setDraft,
  activeColNames,
  tableName,
  schema,
  availableSchemas,
  getTablesForSchema,
  loadTables,
  projectId,
  getDriver,
}: {
  draft: StructureEditorState;
  setDraft: React.Dispatch<React.SetStateAction<StructureEditorState>>;
  activeColNames: string[];
  tableName: string;
  schema: string;
  availableSchemas: string[];
  getTablesForSchema: (schema: string) => string[];
  loadTables: (projectId: string, schema: string) => Promise<void>;
  projectId: string;
  getDriver: () => ReturnType<typeof DriverFactory.getDriver> | null;
}) {
  return (
    <div className="space-y-3 py-1">
      {draft.foreignKeys
        .filter((fk) => fk._status !== "removed")
        .map((fk) => (
          <FKCard
            key={fk._id}
            fk={fk}
            activeColNames={activeColNames}
            availableSchemas={availableSchemas}
            getTablesForSchema={getTablesForSchema}
            loadTables={loadTables}
            projectId={projectId}
            getDriver={getDriver}
            onChange={(updates) => {
              setDraft((prev) => ({
                ...prev,
                foreignKeys: prev.foreignKeys.map((f) =>
                  f._id === fk._id
                    ? {
                        ...f,
                        ...updates,
                        _status: f._status === "existing" ? "existing" : f._status,
                      }
                    : f,
                ),
              }));
            }}
            onRemove={() => {
              setDraft((prev) => ({
                ...prev,
                foreignKeys: prev.foreignKeys
                  .map((f) =>
                    f._id === fk._id
                      ? f._status === "added"
                        ? null
                        : { ...f, _status: "removed" as const }
                      : f,
                  )
                  .filter(Boolean) as DraftForeignKey[],
              }));
            }}
          />
        ))}
      {draft.foreignKeys
        .filter((fk) => fk._status === "removed")
        .map((fk) => (
          <div
            key={fk._id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 opacity-60"
          >
            <span className="text-xs font-mono line-through flex-1">{fk.constraintName}</span>
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  foreignKeys: prev.foreignKeys.map((f) =>
                    f._id === fk._id ? { ...f, _status: "existing" as const } : f,
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
        type="button"
        onClick={() => {
          setDraft((prev) => ({
            ...prev,
            foreignKeys: [
              ...prev.foreignKeys,
              {
                _id: uid(),
                _status: "added",
                constraintName: `${tableName}_fk_${prev.foreignKeys.length + 1}`,
                sourceColumns: [],
                targetSchema: schema,
                targetTable: "",
                targetColumns: [],
                onUpdate: "NO ACTION",
                onDelete: "NO ACTION",
              },
            ],
          }));
        }}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors w-full"
      >
        <Plus className="h-3.5 w-3.5" /> Add Foreign Key
      </button>
    </div>
  );
}
