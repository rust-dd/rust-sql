import { useState, useEffect, useCallback } from "react";
import { DriverFactory } from "@/lib/database-driver";
import { useProjectStore } from "@/stores/project-store";
import type { SchemaObject } from "@/types";
import { cn } from "@/lib/utils";
import { GitCompare, Plus, Minus, RefreshCw, ArrowLeftRight, Table, Eye, Code, Hash } from "lucide-react";
import { Button } from "./ui/button";

interface SchemaDiffPanelProps {
  projectId: string;
}

interface DiffEntry {
  objectType: string;
  name: string;
  status: "only-left" | "only-right" | "modified" | "identical";
  leftDef?: string;
  rightDef?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  table: <Table className="h-3 w-3" />,
  view: <Eye className="h-3 w-3" />,
  matview: <Eye className="h-3 w-3" />,
  function: <Code className="h-3 w-3" />,
  index: <Hash className="h-3 w-3" />,
};

function computeDiff(left: SchemaObject[], right: SchemaObject[]): DiffEntry[] {
  const leftMap = new Map<string, SchemaObject>();
  const rightMap = new Map<string, SchemaObject>();

  for (const o of left) leftMap.set(`${o.object_type}:${o.name}`, o);
  for (const o of right) rightMap.set(`${o.object_type}:${o.name}`, o);

  const entries: DiffEntry[] = [];
  const seen = new Set<string>();

  for (const [key, l] of leftMap) {
    seen.add(key);
    const r = rightMap.get(key);
    if (!r) {
      entries.push({ objectType: l.object_type, name: l.name, status: "only-left", leftDef: l.definition });
    } else if (l.definition.trim() !== r.definition.trim()) {
      entries.push({ objectType: l.object_type, name: l.name, status: "modified", leftDef: l.definition, rightDef: r.definition });
    } else {
      entries.push({ objectType: l.object_type, name: l.name, status: "identical", leftDef: l.definition, rightDef: r.definition });
    }
  }

  for (const [key, r] of rightMap) {
    if (!seen.has(key)) {
      entries.push({ objectType: r.object_type, name: r.name, status: "only-right", rightDef: r.definition });
    }
  }

  const order: Record<string, number> = { modified: 0, "only-left": 1, "only-right": 2, identical: 3 };
  entries.sort((a, b) => order[a.status] - order[b.status] || a.objectType.localeCompare(b.objectType) || a.name.localeCompare(b.name));

  return entries;
}

export function SchemaDiffPanel({ projectId }: SchemaDiffPanelProps) {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [leftSchema, setLeftSchema] = useState("");
  const [rightSchema, setRightSchema] = useState("");
  const [diff, setDiff] = useState<DiffEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DiffEntry | null>(null);
  const [filter, setFilter] = useState("all");
  const projects = useProjectStore((s) => s.projects);

  const driver = projects[projectId] ? DriverFactory.getDriver(projects[projectId].driver) : null;

  useEffect(() => {
    if (!driver) return;
    driver.loadSchemas(projectId).then(setSchemas).catch(() => {});
  }, [driver, projectId]);

  const runDiff = useCallback(async () => {
    if (!driver || !leftSchema || !rightSchema) return;
    setLoading(true);
    setSelected(null);
    try {
      const [leftObjects, rightObjects] = await Promise.all([
        driver.extractSchemaObjects!(projectId, leftSchema),
        driver.extractSchemaObjects!(projectId, rightSchema),
      ]);
      setDiff(computeDiff(leftObjects, rightObjects));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [driver, projectId, leftSchema, rightSchema]);

  const filtered = diff?.filter(
    (d) => filter === "all" || d.status === filter || (filter === "changes" && d.status !== "identical"),
  );
  const counts = diff
    ? {
        modified: diff.filter((d) => d.status === "modified").length,
        onlyLeft: diff.filter((d) => d.status === "only-left").length,
        onlyRight: diff.filter((d) => d.status === "only-right").length,
        identical: diff.filter((d) => d.status === "identical").length,
      }
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Config bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <GitCompare className="h-4 w-4 text-primary shrink-0" />
        <select
          value={leftSchema}
          onChange={(e) => setLeftSchema(e.target.value)}
          className="bg-input/80 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground min-w-[140px]"
        >
          <option value="">Left schema...</option>
          {schemas.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/50" />
        <select
          value={rightSchema}
          onChange={(e) => setRightSchema(e.target.value)}
          className="bg-input/80 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground min-w-[140px]"
        >
          <option value="">Right schema...</option>
          {schemas.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button variant="gradient" size="sm" onClick={runDiff} disabled={!leftSchema || !rightSchema || loading} className="text-xs font-mono gap-1">
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
          Compare
        </Button>
      </div>

      {/* Summary bar */}
      {counts && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 text-[11px] font-mono">
          <button
            onClick={() => setFilter("all")}
            className={cn("px-2 py-0.5 rounded-full transition-colors", filter === "all" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            All ({diff?.length ?? 0})
          </button>
          <button
            onClick={() => setFilter("changes")}
            className={cn("px-2 py-0.5 rounded-full transition-colors", filter === "changes" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Changes ({counts.modified + counts.onlyLeft + counts.onlyRight})
          </button>
          {counts.modified > 0 && (
            <button
              onClick={() => setFilter("modified")}
              className={cn("px-2 py-0.5 rounded-full transition-colors", filter === "modified" ? "bg-amber-500/20 text-amber-500" : "text-amber-500/60 hover:text-amber-500")}
            >
              Modified ({counts.modified})
            </button>
          )}
          {counts.onlyLeft > 0 && (
            <button
              onClick={() => setFilter("only-left")}
              className={cn("px-2 py-0.5 rounded-full transition-colors", filter === "only-left" ? "bg-destructive/20 text-destructive" : "text-destructive/60 hover:text-destructive")}
            >
              Only in {leftSchema} ({counts.onlyLeft})
            </button>
          )}
          {counts.onlyRight > 0 && (
            <button
              onClick={() => setFilter("only-right")}
              className={cn("px-2 py-0.5 rounded-full transition-colors", filter === "only-right" ? "bg-success/20 text-success" : "text-success/60 hover:text-success")}
            >
              Only in {rightSchema} ({counts.onlyRight})
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div className="w-[320px] border-r border-border/30 overflow-y-auto">
          {!diff ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm font-mono">Select schemas and compare</div>
          ) : filtered && filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm font-mono">No differences found</div>
          ) : (
            filtered?.map((entry, i) => (
              <button
                key={i}
                onClick={() => setSelected(entry)}
                className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs font-mono transition-colors", selected === entry ? "bg-accent" : "hover:bg-muted/30")}
              >
                <span
                  className={cn(
                    "shrink-0",
                    entry.status === "only-left" && "text-destructive",
                    entry.status === "only-right" && "text-success",
                    entry.status === "modified" && "text-amber-500",
                    entry.status === "identical" && "text-muted-foreground/40",
                  )}
                >
                  {entry.status === "only-left" && <Minus className="h-3 w-3" />}
                  {entry.status === "only-right" && <Plus className="h-3 w-3" />}
                  {entry.status === "modified" && <RefreshCw className="h-3 w-3" />}
                  {entry.status === "identical" && (typeIcons[entry.objectType] || null)}
                </span>
                <span className="text-muted-foreground/50">{typeIcons[entry.objectType]}</span>
                <span className={cn("truncate", entry.status === "identical" && "text-muted-foreground/40")}>{entry.name}</span>
                <span className="ml-auto text-[9px] text-muted-foreground/40">{entry.objectType}</span>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-auto p-4">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-mono font-semibold">
                <span
                  className={cn(
                    selected.status === "only-left" && "text-destructive",
                    selected.status === "only-right" && "text-success",
                    selected.status === "modified" && "text-amber-500",
                  )}
                >
                  {selected.objectType}
                </span>
                <span>{selected.name}</span>
              </div>
              {selected.status === "modified" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">{leftSchema}</div>
                    <pre className="text-xs font-mono bg-destructive/5 border border-destructive/20 rounded-xl p-3 overflow-auto max-h-[500px] whitespace-pre-wrap">
                      {selected.leftDef}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">{rightSchema}</div>
                    <pre className="text-xs font-mono bg-success/5 border border-success/20 rounded-xl p-3 overflow-auto max-h-[500px] whitespace-pre-wrap">
                      {selected.rightDef}
                    </pre>
                  </div>
                </div>
              ) : (
                <pre className="text-xs font-mono bg-muted/20 border border-border/30 rounded-xl p-3 overflow-auto max-h-[500px] whitespace-pre-wrap">
                  {selected.leftDef || selected.rightDef || "No definition available"}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm font-mono">Select an object to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
