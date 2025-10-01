import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import React, { useCallback, useEffect, useState } from "react";
import { useKeyPressEvent } from "react-use";
import { Play, Save, Database, PanelLeftClose, PanelLeft, Plus, Table as TableIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/resize-handle";
import { ConnectionModal, type ConnectionConfig } from "@/components/connection-modal";
import "@/monaco/setup";
import {
  deleteProject,
  deleteQuery,
  getProjects,
  getQueries,
  insertProject,
  insertQuery,
  pgsqlConnector,
  pgsqlLoadColumns,
  pgsqlLoadSchemas,
  pgsqlLoadTables,
  pgsqlRunQuery,
  ProjectConnectionStatus,
  ProjectMap,
  QueryMap,
  TableInfo,
} from "@/tauri";

type Tab = {
  id: number;
  projectId?: string;
  editorValue: string;
  result?: { columns: string[]; rows: string[][]; time: number };
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [editorHeight, setEditorHeight] = useState(50);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "record">("grid");
  const [selectedRow, setSelectedRow] = useState<number>(0);

  const [projects, setProjects] = useState<ProjectMap>({});
  const [queries, setQueries] = useState<QueryMap>({});
  const [status, setStatus] = useState<Record<string, ProjectConnectionStatus>>({});
  const [schemas, setSchemas] = useState<Record<string, string[]>>({});
  const [tables, setTables] = useState<Record<string, TableInfo[]>>({});
  const [columns, setColumns] = useState<Record<string, string[]>>({});

  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, editorValue: "" }]);
  const [selectedTab, setSelectedTab] = useState(0);

  const activeTab = tabs[selectedTab];
  const activeProject = activeTab?.projectId;
  const activeProjectDetails = activeProject ? projects[activeProject] : undefined;
  const activeDatabase = activeProjectDetails?.[3] ?? "";

  const projectsRef = React.useRef<ProjectMap>({});
  const schemasRef = React.useRef<Record<string, string[]>>({});
  const tablesRef = React.useRef<Record<string, TableInfo[]>>({});
  const columnsRef = React.useRef<Record<string, string[]>>({});
  const activeProjectRef = React.useRef<string | undefined>(undefined);

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { schemasRef.current = schemas; }, [schemas]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);

  function registerContextAwareCompletions(monaco: typeof Monaco) {
    type TableRef = { schema?: string; table: string };
    function stripQuotes(s: string) { return s.replaceAll('"', ""); }
    function extractAliasMap(sql: string): Record<string, TableRef> {
      const map: Record<string, TableRef> = {};
      const re = /(from|join)\s+("?[A-Za-z0-9_]+"?)(?:\s*\.\s*("?[A-Za-z0-9_]+"?))?(?:\s+as)?\s+("?[A-Za-z0-9_]+"?)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        const schemaMaybe = m[3] ? stripQuotes(m[2]) : undefined;
        const table = stripQuotes(m[3] ?? m[2]);
        const alias = stripQuotes(m[4]);
        map[alias] = { schema: schemaMaybe, table };
      }
      return map;
    }
    async function resolveTableRef(projectId: string, ref: TableRef): Promise<{ schema: string; table: string } | null> {
      if (ref.schema) return { schema: ref.schema, table: ref.table };
      const projSchemas = schemasRef.current[projectId] || [];
      for (const schema of projSchemas) {
        const key = `${projectId}::${schema}`;
        let t = tablesRef.current[key];
        if (!t) {
          try {
            t = await pgsqlLoadTables(projectId, schema);
            tablesRef.current[key] = t;
            setTables((prev) => ({ ...prev, [key]: t! }));
          } catch {}
        }
        if (t && t.some(([name]) => name === ref.table)) return { schema, table: ref.table };
      }
      return { schema: "public", table: ref.table };
    }
    monaco.languages.registerCompletionItemProvider("pgsql", {
      triggerCharacters: [".", " ", '"'],
      provideCompletionItems: async (model, position) => {
        const projectId = activeProjectRef.current;
        if (!projectId) return { suggestions: [] };
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1, startColumn: 1,
          endLineNumber: position.lineNumber, endColumn: position.column,
        });
        const context = textUntilPosition.slice(-1000);
        const aliasMap = extractAliasMap(context);
        const suggestions: Monaco.languages.CompletionItem[] = [];
        const add = (label: string, kind: Monaco.languages.CompletionItemKind, insert?: string, snippet?: boolean) => {
          const item: any = { label, kind, insertText: insert ?? label, range: undefined };
          if (snippet) {
            item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          }
          suggestions.push(item);
        };
        const genAlias = (table: string) => {
          const raw = table.replace(/"/g, "");
          const parts = raw.split("_").filter(Boolean);
          if (parts.length === 0) return raw.slice(0, 1);
          if (parts.length === 1) return parts[0].slice(0, 1);
          return parts.map((p) => p[0]).join("");
        };
        const lowCtx = context.toLowerCase();
        const tableCtx = /([a-z0-9_"]+)\s*\.\s*([a-z0-9_"]*)$/.exec(lowCtx);
        if (tableCtx) {
          const origCtx = /([A-Za-z0-9_"]+)\s*\.\s*([A-Za-z0-9_"]*)$/.exec(context);
          if (origCtx) {
            const left = stripQuotes(origCtx[1]);
            const right = stripQuotes(origCtx[2]);
            if (aliasMap[left]) {
              const resolved = await resolveTableRef(projectId, aliasMap[left]);
              if (resolved) {
                const colKey = `${projectId}::${resolved.schema}::${resolved.table}`;
                let cols = columnsRef.current[colKey];
                if (!cols) {
                  try {
                    cols = await pgsqlLoadColumns(projectId, resolved.schema, resolved.table);
                    columnsRef.current[colKey] = cols;
                    setColumns((prev) => ({ ...prev, [colKey]: cols! }));
                  } catch {}
                }
                if (cols) cols.forEach((c) => add(c, monaco.languages.CompletionItemKind.Property, `"${c}"`));
                return { suggestions };
              }
            }
            if (right.length === 0) {
              const schema = left;
              const key = `${projectId}::${schema}`;
              let t = tablesRef.current[key];
              if (!t) {
                try {
                  t = await pgsqlLoadTables(projectId, schema);
                  tablesRef.current[key] = t;
                  setTables((prev) => ({ ...prev, [key]: t! }));
                } catch {}
              }
              if (t) {
                for (const [tname] of t) {
                  const alias = genAlias(tname);
                  add(`${schema}.${tname} ${alias}`, monaco.languages.CompletionItemKind.Field, `"${schema}"."${tname}" \${1:${alias}}`, true);
                }
              }
              return { suggestions };
            }
            const colKey = `${projectId}::${left}::${right}`;
            let cols = columnsRef.current[colKey];
            if (!cols) {
              try {
                cols = await pgsqlLoadColumns(projectId, left, right);
                columnsRef.current[colKey] = cols;
                setColumns((prev) => ({ ...prev, [colKey]: cols! }));
              } catch {}
            }
            if (cols) cols.forEach((c) => add(c, monaco.languages.CompletionItemKind.Property, `"${c}"`));
            return { suggestions };
          }
        }
        const fromCtx = /(from|join)\s+([A-Za-z0-9_".]*)$/.exec(lowCtx);
        if (fromCtx) {
          const projSchemas = schemasRef.current[projectId] || [];
          for (const schema of projSchemas) {
            const key = `${projectId}::${schema}`;
            let t = tablesRef.current[key];
            if (!t) {
              try {
                t = await pgsqlLoadTables(projectId, schema);
                tablesRef.current[key] = t;
                setTables((prev) => ({ ...prev, [key]: t! }));
              } catch {}
            }
            if (t)
              for (const [tname] of t) {
                const alias = genAlias(tname);
                add(`${schema}.${tname} ${alias}`, monaco.languages.CompletionItemKind.Field, `"${schema}"."${tname}" \${1:${alias}}`, true);
              }
          }
          return { suggestions };
        }
        const projSchemas = schemasRef.current[projectId] || [];
        projSchemas.forEach((s) => add(s, monaco.languages.CompletionItemKind.Module, `"${s}"`));
        return { suggestions };
      },
    });
  }

  useEffect(() => {
    (async () => {
      setProjects(await getProjects());
      setQueries(await getQueries());
    })();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runQuery();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  useKeyPressEvent("Enter", (e) => {
    const ev = e as unknown as KeyboardEvent;
    if (ev.metaKey || ev.ctrlKey) {
      ev.preventDefault();
      void runQuery();
    }
  });

  const reloadProjects = useCallback(async () => setProjects(await getProjects()), []);
  const reloadQueries = useCallback(async () => setQueries(await getQueries()), []);

  const onConnect = useCallback(async (project_id: string) => {
    const d = projects[project_id];
    if (!d) return;
    setStatus((s) => ({ ...s, [project_id]: ProjectConnectionStatus.Connecting }));
    const key: [string, string, string, string, string] = [d[1], d[2], d[3], d[4], d[5]];
    try {
      const st = await pgsqlConnector(project_id, key);
      setStatus((s) => ({ ...s, [project_id]: st }));
      if (st === ProjectConnectionStatus.Connected) {
        const sc = await pgsqlLoadSchemas(project_id);
        setSchemas((prev) => ({ ...prev, [project_id]: sc }));
      }
    } catch {
      setStatus((s) => ({ ...s, [project_id]: ProjectConnectionStatus.Failed }));
    }
  }, [projects]);

  const onOpenProjectTab = useCallback((project_id: string) => {
    setTabs((ts) => [...ts, { id: ts.length + 1, projectId: project_id, editorValue: "" }]);
    setSelectedTab((i) => i + 1);
  }, []);

  const onLoadTables = useCallback(async (project_id: string, schema: string) => {
    const key = `${project_id}::${schema}`;
    if (tables[key]) return;
    const rows = await pgsqlLoadTables(project_id, schema);
    setTables((t) => ({ ...t, [key]: rows }));
  }, [tables]);

  const onOpenDefaultTableQuery = useCallback((project_id: string, schema: string, table: string) => {
    const sql = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    setTabs((ts) => [...ts, { id: ts.length + 1, projectId: project_id, editorValue: sql }]);
    setSelectedTab((i) => i + 1);
  }, []);

  const runQuery = useCallback(async () => {
    if (!activeProject || !activeTab) return;
    const [cols, rows, time] = await pgsqlRunQuery(activeProject, activeTab.editorValue);
    setTabs((ts) => {
      const copy = ts.slice();
      copy[selectedTab] = { ...copy[selectedTab], result: { columns: cols, rows, time } };
      return copy;
    });
    setSelectedRow(0);
  }, [activeProject, activeTab, selectedTab]);

  const saveQuery = useCallback(async (title: string) => {
    if (!activeProject) return;
    const driver = "PGSQL";
    const queryId = `${activeProject}:${activeDatabase}:${driver}:${title}`;
    await insertQuery(queryId, activeTab?.editorValue ?? "");
    await reloadQueries();
  }, [activeProject, activeDatabase, activeTab?.editorValue, reloadQueries]);

  const onDeleteProject = useCallback(async (project_id: string) => {
    await deleteProject(project_id);
    await reloadProjects();
    setStatus((s) => ({ ...s, [project_id]: ProjectConnectionStatus.Disconnected }));
  }, [reloadProjects]);

  const handleSidebarResize = (delta: number) => setSidebarWidth((prev) => Math.max(200, Math.min(600, prev + delta)));
  const handleEditorResize = (delta: number) => {
    const containerHeight = window.innerHeight - 48;
    const deltaPercent = (delta / containerHeight) * 100;
    setEditorHeight((prev) => Math.max(20, Math.min(80, prev + deltaPercent)));
  };

  const handleSaveConnection = useCallback(async (connection: ConnectionConfig) => {
    const details = ["PGSQL", connection.username, connection.password, connection.database, connection.host, connection.port];
    await insertProject(connection.name, details);
    await reloadProjects();
  }, [reloadProjects]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <span className="font-mono text-sm font-semibold">PostgresGUI</span>
          </div>
          {activeProject && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${status[activeProject] === ProjectConnectionStatus.Connected ? "bg-success" : "bg-destructive"}`} />
                <span className="font-mono">{activeProject}</span>
                {activeProjectDetails && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{activeProjectDetails[4]}:{activeProjectDetails[5]}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => { const title = prompt("Query title?"); if (title) void saveQuery(title); }}>
            <Save className="h-4 w-4" />
            <span className="text-xs">Save</span>
          </Button>
          <Button variant="default" size="sm" className="h-8 gap-2 bg-primary text-primary-foreground" onClick={async () => await runQuery()}>
            <Play className="h-4 w-4" />
            <span className="text-xs">Execute (⌘+Enter)</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Button variant="ghost" size="icon" className="absolute left-2 top-16 z-10 h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>

        {sidebarOpen && (
          <>
            <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0">
              <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
                <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-3">
                  <span className="font-mono text-xs font-semibold text-sidebar-foreground">CONNECTIONS</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConnectionModalOpen(true)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                {Object.entries(projects).map(([project_id]) => {
                    const st = status[project_id] ?? ProjectConnectionStatus.Disconnected;
                    const projectSchemas = schemas[project_id] ?? [];
                    return (
                      <div key={project_id} className="mb-2">
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <button onClick={() => onConnect(project_id)} disabled={st === ProjectConnectionStatus.Connecting} className="flex items-center gap-2 text-xs font-mono font-semibold hover:text-primary">
                            <div className={`h-2 w-2 rounded-full ${st === ProjectConnectionStatus.Connected ? "bg-success" : st === ProjectConnectionStatus.Connecting ? "bg-warning" : "bg-destructive"}`} />
                            {project_id}
                          </button>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenProjectTab(project_id)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteProject(project_id)}><X className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        {st === ProjectConnectionStatus.Connected && (
                          <div className="ml-4 mt-1">
                            {projectSchemas.length === 0 ? (
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onConnect(project_id)}>Load Schemas</Button>
                            ) : (
                              <div>
                                {projectSchemas.map((schema) => {
                                  const key = `${project_id}::${schema}`;
                                  const t = tables[key];
                                  return (
                                    <div key={schema} className="mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold font-mono">{schema}</span>
                                        {!t && <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => onLoadTables(project_id, schema)}>Load</Button>}
                                      </div>
                                      {t && (
                                        <ul className="ml-2 mt-1">
                                          {t.map(([tableName, size]) => (
                                            <li key={tableName}>
                                              <button onClick={() => onOpenDefaultTableQuery(project_id, schema, tableName)} className="text-[10px] font-mono hover:text-primary flex items-center gap-1">
                                                <TableIcon className="h-3 w-3" />
                                                {tableName} <span className="text-muted-foreground">({size})</span>
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(queries).length > 0 && (
                  <div className="border-t border-sidebar-border p-2">
                    <h4 className="text-xs font-semibold mb-2 font-mono">SAVED QUERIES</h4>
                    <ul>
                      {Object.entries(queries).map(([id, sql]) => (
                        <li key={id} className="mb-1">
                          <div className="flex items-center justify-between">
                            <button onClick={() => { setTabs((ts) => [...ts, { id: ts.length + 1, editorValue: sql }]); setSelectedTab((i) => i + 1); }} className="text-[10px] font-mono hover:text-primary truncate flex-1 text-left">{id}</button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await deleteQuery(id); await reloadQueries(); }}><X className="h-2 w-2" /></Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
          </>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div style={{ height: `${editorHeight}%` }} className="flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-border bg-card">
              <div className="flex flex-1 items-center overflow-x-auto">
                {tabs.map((tab, idx) => (
                  <div key={tab.id} className={`group flex items-center gap-2 border-r border-border px-4 py-2.5 transition-colors ${selectedTab === idx ? "bg-editor-bg text-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                    <button onClick={() => setSelectedTab(idx)} className="font-mono text-xs">Tab {idx + 1}</button>
                    {tabs.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); const newTabs = tabs.filter((_, i) => i !== idx); setTabs(newTabs); if (selectedTab === idx && newTabs.length > 0) setSelectedTab(Math.min(idx, newTabs.length - 1)); }} className="opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setTabs((ts) => [...ts, { id: ts.length + 1, editorValue: "" }])} className="h-9 w-9 shrink-0"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="relative flex-1 overflow-hidden bg-editor-bg">
              <Editor height="100%" defaultLanguage="pgsql" language="pgsql" beforeMount={registerContextAwareCompletions} options={{ automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true, theme: "vs-dark" }} value={activeTab?.editorValue} onChange={(v) => { const value = v ?? ""; setTabs((ts) => { const copy = ts.slice(); copy[selectedTab] = { ...copy[selectedTab], editorValue: value }; return copy; }); }} onMount={(editor, monaco) => { editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void runQuery()); editor.addAction({ id: "run-query", label: "Run Query", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => void runQuery() }); editor.onKeyDown((e) => { if (e.equals(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter)) { e.preventDefault(); void runQuery(); } }); }} />
            </div>
          </div>
          <ResizeHandle direction="vertical" onResize={handleEditorResize} />
          <div className="flex-1 min-h-0">
            {!activeTab?.result ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data to display</div>
            ) : (
              <div className="flex h-full flex-col border-t border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-2 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-foreground">RESULTS</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activeTab.result.rows.length} rows</span>
                      <span>•</span>
                      <span>{activeTab.result.time.toFixed(0)}ms</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>Grid</Button>
                    <Button variant={viewMode === "record" ? "default" : "outline"} size="sm" disabled={!activeTab.result.rows.length} onClick={() => setViewMode("record")}>Record</Button>
                  </div>
                </div>
                {viewMode === "grid" ? (
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full border-collapse font-mono text-xs">
                      <thead className="sticky top-0 bg-secondary z-10">
                        <tr>{activeTab.result.columns.map((c) => (<th key={c} className="border-b border-r border-border px-4 py-2 text-left font-semibold whitespace-nowrap">{c}</th>))}</tr>
                      </thead>
                      <tbody>
                        {activeTab.result.rows.map((r, i) => (
                          <tr key={i} className={`${selectedRow === i ? "bg-accent" : ""} hover:bg-accent/50 cursor-pointer`} onClick={() => setSelectedRow(i)}>
                            {r.map((cell, j) => (<td key={j} className="border-b border-r border-border px-4 py-2 whitespace-nowrap">{cell}</td>))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-4">
                    {activeTab.result.rows.length === 0 ? (
                      <div className="flex items-center justify-center p-4 text-muted-foreground">No row selected</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedRow((i) => Math.max(0, i - 1))}>Prev</Button>
                          <span className="text-sm text-muted-foreground">Row {selectedRow + 1} of {activeTab.result.rows.length}</span>
                          <Button variant="outline" size="sm" onClick={() => setSelectedRow((i) => Math.min((activeTab?.result?.rows.length ?? 1) - 1, i + 1))}>Next</Button>
                        </div>
                        <table className="w-full border-collapse">
                          <tbody>
                            {activeTab.result.columns.map((col, idx) => (
                              <tr key={col}>
                                <td className="w-1/3 border-b border-border px-2 py-1 font-medium">{col}</td>
                                <td className="border-b border-border px-2 py-1">{activeTab?.result?.rows[selectedRow]?.[idx] ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ConnectionModal open={connectionModalOpen} onOpenChange={setConnectionModalOpen} onSave={handleSaveConnection} />
    </div>
  );
}
