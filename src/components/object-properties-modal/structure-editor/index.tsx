import { Button } from "@/components/ui/button";
import type { StructureEditorState } from "@/lib/alter-table-sql";
import {
  countChanges,
  generateAlterTableSQL,
} from "@/lib/alter-table-sql";
import { DriverFactory } from "@/lib/database-driver";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project-store";
import {
  AlertTriangle,
  Copy,
  FileCode,
  Loader2,
  Play,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingPlaceholder } from "../shared";
import type { FKInfo } from "../types";
import { ColumnsSection } from "./columns-section";
import { FkeysSection } from "./fkeys-section";
import { IndexesSection } from "./indexes-section";
import {
  initStructureState,
  type StructureSubTab,
} from "./initialization";
import { PkSection } from "./pk-section";
import { UniqueSection } from "./unique-section";

export function StructureEditorContent({
  projectId,
  schema,
  tableName,
  cols,
  idxs,
  cons,
  outgoingFKs,
  getDriver,
  onApplied,
  openTab,
  onOpenChange,
}: {
  projectId: string;
  schema: string;
  tableName: string;
  cols: import("@/types").ColumnDetail[] | undefined;
  idxs: import("@/types").IndexDetail[] | undefined;
  cons: import("@/types").ConstraintDetail[] | undefined;
  outgoingFKs: FKInfo[];
  getDriver: () => ReturnType<typeof DriverFactory.getDriver> | null;
  onApplied: () => void;
  openTab: (projectId?: string, sql?: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [subTab, setSubTab] = useState<StructureSubTab>("columns");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const initialState = useMemo(
    () => initStructureState(cols, idxs, cons, outgoingFKs),
    [cols, idxs, cons, outgoingFKs],
  );
  const [draft, setDraft] = useState<StructureEditorState>(initialState);

  // Reset draft when source data refreshes (e.g. after re-opening the modal)
  useEffect(() => {
    setDraft(initialState);
    setError(null);
    setShowSql(false);
  }, [initialState]);

  const changes = countChanges(draft);
  const activeColNames = draft.columns
    .filter((c) => c._status !== "removed")
    .map((c) => c.name);

  const tables = useProjectStore((s) => s.tables);
  const schemas = useProjectStore((s) => s.schemas);
  const loadTables = useProjectStore((s) => s.loadTables);
  const availableSchemas = schemas[projectId] ?? [];
  const getTablesForSchema = (s: string) =>
    (tables[`${projectId}::${s}`] ?? []).map((t) => t.name);

  const sqlStatements = useMemo(
    () => generateAlterTableSQL(schema, tableName, initialState, draft),
    [schema, tableName, initialState, draft],
  );
  const sqlPreview = sqlStatements.join("\n");

  const applyChanges = useCallback(async () => {
    const driver = getDriver();
    if (!driver || sqlStatements.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await driver.runQuery(projectId, "BEGIN");
      try {
        for (const stmt of sqlStatements) {
          await driver.runQuery(projectId, stmt);
        }
        await driver.runQuery(projectId, "COMMIT");
      } catch (err) {
        await driver.runQuery(projectId, "ROLLBACK").catch(() => {});
        throw err;
      }
      toast.success("Table structure updated");
      onApplied();
    } catch (err: any) {
      setError(err?.message ?? "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  }, [getDriver, projectId, sqlStatements, onApplied]);

  const subTabs: { key: StructureSubTab; label: string }[] = [
    { key: "columns", label: "Columns" },
    { key: "pk", label: "Primary Key" },
    { key: "fkeys", label: "Foreign Keys" },
    { key: "unique", label: "Unique" },
    { key: "indexes", label: "Indexes" },
  ];

  if (!cols) return <LoadingPlaceholder />;

  return (
    <div className="flex-1 flex flex-col min-h-0 pt-2">
      <div className="flex gap-0.5 bg-background/30 rounded-lg p-0.5 border border-border/20 shrink-0 mb-2">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
              subTab === t.key
                ? "bg-background text-foreground shadow-sm shadow-black/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === "columns" && (
          <ColumnsSection draft={draft} setDraft={setDraft} />
        )}

        {subTab === "pk" && (
          <PkSection
            draft={draft}
            setDraft={setDraft}
            activeColNames={activeColNames}
            tableName={tableName}
          />
        )}

        {subTab === "fkeys" && (
          <FkeysSection
            draft={draft}
            setDraft={setDraft}
            activeColNames={activeColNames}
            tableName={tableName}
            schema={schema}
            availableSchemas={availableSchemas}
            getTablesForSchema={getTablesForSchema}
            loadTables={loadTables}
            projectId={projectId}
            getDriver={getDriver}
          />
        )}

        {subTab === "unique" && (
          <UniqueSection
            draft={draft}
            setDraft={setDraft}
            activeColNames={activeColNames}
            tableName={tableName}
          />
        )}

        {subTab === "indexes" && (
          <IndexesSection
            draft={draft}
            setDraft={setDraft}
            activeColNames={activeColNames}
            tableName={tableName}
          />
        )}
      </div>

      {showSql && sqlStatements.length > 0 && (
        <div className="shrink-0 mt-2 rounded-xl border border-border/40 overflow-hidden bg-[hsl(var(--background))]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30">
            <span className="text-[10px] font-mono text-muted-foreground/60">
              SQL Preview
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  openTab(projectId, sqlPreview);
                  onOpenChange(false);
                }}
              >
                <Play className="h-2.5 w-2.5" /> Open in Tab
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigator.clipboard.writeText(sqlPreview)}
              >
                <Copy className="h-2.5 w-2.5" /> Copy
              </Button>
            </div>
          </div>
          <pre className="p-3 text-[11px] font-mono text-foreground/90 overflow-y-auto whitespace-pre-wrap leading-relaxed max-h-[150px] selection:bg-primary/20">
            {sqlPreview}
          </pre>
        </div>
      )}

      {error && (
        <div className="shrink-0 mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs font-mono">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {changes > 0 && (
        <div className="shrink-0 mt-2 flex items-center gap-2 pt-2 border-t border-border/20">
          <span className="text-[10px] font-medium text-muted-foreground">
            {changes} change{changes !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground"
            onClick={() => {
              setDraft(initialState);
              setError(null);
              setShowSql(false);
            }}
          >
            Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setShowSql((v) => !v)}
          >
            <FileCode className="h-3 w-3 mr-1" />
            {showSql ? "Hide SQL" : "Review SQL"}
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-[11px]"
            disabled={applying || sqlStatements.length === 0}
            onClick={() => void applyChanges()}
          >
            {applying ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
