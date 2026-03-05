import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { Search, Table, Eye, FileCode, Layers, Database } from "lucide-react";

interface SearchResult {
  type: "table" | "view" | "matview" | "function" | "schema";
  projectId: string;
  schema: string;
  name: string;
  detail?: string;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;
  let score = 0;
  let qi = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (lastMatch === ti - 1) score += 5; // consecutive bonus
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

const typeIcons = {
  table: <Table className="h-4 w-4 text-muted-foreground" />,
  view: <Eye className="h-4 w-4 text-muted-foreground" />,
  matview: <Layers className="h-4 w-4 text-muted-foreground" />,
  function: <FileCode className="h-4 w-4 text-muted-foreground" />,
  schema: <Database className="h-4 w-4 text-muted-foreground" />,
};

const typeLabels = {
  table: "Table",
  view: "View",
  matview: "Materialized View",
  function: "Function",
  schema: "Schema",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tables = useProjectStore((s) => s.tables);
  const views = useProjectStore((s) => s.views);
  const materializedViews = useProjectStore((s) => s.materializedViews);
  const functions = useProjectStore((s) => s.functions);
  const schemas = useProjectStore((s) => s.schemas);
  const openTab = useTabStore((s) => s.openTab);

  // Build search index
  const allItems = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];

    for (const [key, schemaTables] of Object.entries(tables)) {
      const [projectId, schema] = key.split("::");
      for (const t of schemaTables) {
        items.push({ type: "table", projectId, schema, name: t.name, detail: t.size });
      }
    }

    for (const [key, schemaViews] of Object.entries(views)) {
      const [projectId, schema] = key.split("::");
      for (const v of schemaViews) {
        items.push({ type: "view", projectId, schema, name: v });
      }
    }

    for (const [key, matViews] of Object.entries(materializedViews)) {
      const [projectId, schema] = key.split("::");
      for (const mv of matViews) {
        items.push({ type: "matview", projectId, schema, name: mv });
      }
    }

    for (const [key, fns] of Object.entries(functions)) {
      const [projectId, schema] = key.split("::");
      for (const fn of fns) {
        items.push({ type: "function", projectId, schema, name: fn.name, detail: `(${fn.arguments || ""}) -> ${fn.returnType}` });
      }
    }

    for (const [projectId, projectSchemas] of Object.entries(schemas)) {
      for (const s of projectSchemas) {
        items.push({ type: "schema", projectId, schema: s, name: s });
      }
    }

    return items;
  }, [tables, views, materializedViews, functions, schemas]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 50);
    return allItems
      .filter((item) => fuzzyMatch(query, item.name) || fuzzyMatch(query, `${item.schema}.${item.name}`))
      .sort((a, b) => {
        const sa = Math.max(fuzzyScore(query, a.name), fuzzyScore(query, `${a.schema}.${a.name}`));
        const sb = Math.max(fuzzyScore(query, b.name), fuzzyScore(query, `${b.schema}.${b.name}`));
        return sb - sa;
      })
      .slice(0, 50);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback((item: SearchResult) => {
    onClose();
    if (item.type === "table" || item.type === "view" || item.type === "matview") {
      openTab(item.projectId, `SELECT * FROM "${item.schema}"."${item.name}" LIMIT 100;`);
    } else if (item.type === "function") {
      openTab(item.projectId, `-- Function: ${item.schema}.${item.name}\nSELECT pg_get_functiondef(p.oid)\nFROM pg_proc p\nJOIN pg_namespace n ON n.oid = p.pronamespace\nWHERE n.nspname = '${item.schema}' AND p.proname = '${item.name}'\nLIMIT 1;`);
    } else if (item.type === "schema") {
      openTab(item.projectId, `-- Schema: ${item.name}\n`);
    }
  }, [openTab, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [filtered, selectedIndex, handleSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-[15%] z-50 w-[560px] -translate-x-1/2 rounded-lg border border-border bg-popover shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tables, views, functions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
          />
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={`${item.type}-${item.projectId}-${item.schema}-${item.name}-${i}`}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {typeIcons[item.type]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground truncate">{item.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                      {typeLabels[item.type]}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    {item.projectId} / {item.schema}
                    {item.detail ? ` — ${item.detail}` : ""}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
