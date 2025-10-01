import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useKeyPressEvent } from "react-use";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import "./monaco/setup";
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
} from "./tauri";

// Types
type Tab = {
  id: number;
  projectId?: string;
  editorValue: string;
  result?: { columns: string[]; rows: string[][]; time: number };
};

export default function App() {
  const SIDEBAR_WIDTH = 320;

  // Global state
  const [projects, setProjects] = useState<ProjectMap>({});
  const [queries, setQueries] = useState<QueryMap>({});
  const [status, setStatus] = useState<Record<string, ProjectConnectionStatus>>(
    {},
  );
  const [schemas, setSchemas] = useState<Record<string, string[]>>({});
  const [tables, setTables] = useState<Record<string, TableInfo[]>>({});
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<"grid" | "record">("grid");
  const [selectedRow, setSelectedRow] = useState<number>(0);

  // Tabs state
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, editorValue: "" }]);
  const [selectedTab, setSelectedTab] = useState(0);

  // Derived helpers
  const activeTab = tabs[selectedTab];
  const activeProject = activeTab?.projectId;
  const activeProjectDetails = activeProject
    ? projects[activeProject]
    : undefined;
  const activeDatabase = activeProjectDetails?.[3] ?? "";

  // Refs for IntelliSense (keep latest state for Monaco provider)
  const projectsRef = React.useRef<ProjectMap>({});
  const schemasRef = React.useRef<Record<string, string[]>>({});
  const tablesRef = React.useRef<Record<string, TableInfo[]>>({});
  const columnsRef = React.useRef<Record<string, string[]>>({});
  const activeProjectRef = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);
  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  // Register Monaco completion provider for schema/table/column suggestions
  function registerContextAwareCompletions(monaco: typeof Monaco) {
    type TableRef = { schema?: string; table: string };

    function stripQuotes(s: string) {
      return s.replaceAll('"', "");
    }

    function extractAliasMap(sql: string): Record<string, TableRef> {
      const map: Record<string, TableRef> = {};
      // Look for FROM/JOIN patterns with optional schema and alias
      const re =
        /(from|join)\s+("?[A-Za-z0-9_]+"?)(?:\s*\.\s*("?[A-Za-z0-9_]+"?))?(?:\s+as)?\s+("?[A-Za-z0-9_]+"?)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        const schemaMaybe = m[3] ? stripQuotes(m[2]) : undefined;
        const table = stripQuotes(m[3] ?? m[2]);
        const alias = stripQuotes(m[4]);
        map[alias] = { schema: schemaMaybe, table };
      }
      return map;
    }

    async function resolveTableRef(
      projectId: string,
      ref: TableRef,
    ): Promise<{ schema: string; table: string } | null> {
      // If schema known, return it
      if (ref.schema) return { schema: ref.schema, table: ref.table };
      // Try to find table across cached tables
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
        if (t && t.some(([name]) => name === ref.table)) {
          return { schema, table: ref.table };
        }
      }
      // As a fallback, assume public
      return { schema: "public", table: ref.table };
    }

    monaco.languages.registerCompletionItemProvider("pgsql", {
      triggerCharacters: [".", " ", '"'],
      provideCompletionItems: async (model, position) => {
        const projectId = activeProjectRef.current;
        if (!projectId) return { suggestions: [] };

        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const context = textUntilPosition.slice(-1000); // recent context
        const aliasMap = extractAliasMap(context);

        const suggestions: Monaco.languages.CompletionItem[] = [];

        const add = (
          label: string,
          kind: Monaco.languages.CompletionItemKind,
          insert?: string,
          snippet?: boolean,
        ) => {
          const item: Monaco.languages.CompletionItem = {
            label,
            kind,
            insertText: insert ?? label,
          };
          if (snippet) {
            // @ts-expect-error monaco types available at runtime
            item.insertTextRules =
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          }
          suggestions.push(item);
        };

        const genAlias = (table: string) => {
          const raw = table.replace(/\"/g, "");
          const parts = raw.split("_").filter(Boolean);
          if (parts.length === 0) return raw.slice(0, 1);
          if (parts.length === 1) return parts[0].slice(0, 1);
          return parts.map((p) => p[0]).join("");
        };

        // Detect alias.table or schema.table context for column suggestions
        const lowCtx = context.toLowerCase();
        const tableCtx = /([a-z0-9_\"]+)\s*\.\s*([a-z0-9_\"]*)$/.exec(lowCtx);
        if (tableCtx) {
          // Extract original text to preserve quotes/case for insertion
          const origCtx = /([A-Za-z0-9_\"]+)\s*\.\s*([A-Za-z0-9_\"]*)$/.exec(
            context,
          );
          if (origCtx) {
            const leftRaw = origCtx[1];
            const rightRaw = origCtx[2];
            const left = stripQuotes(leftRaw);
            const right = stripQuotes(rightRaw);

            // If left matches alias, resolve underlying table
            if (aliasMap[left]) {
              const resolved = await resolveTableRef(projectId, aliasMap[left]);
              if (resolved) {
                const colKey = `${projectId}::${resolved.schema}::${resolved.table}`;
                let cols = columnsRef.current[colKey];
                if (!cols) {
                  try {
                    cols = await pgsqlLoadColumns(
                      projectId,
                      resolved.schema,
                      resolved.table,
                    );
                    columnsRef.current[colKey] = cols;
                    setColumns((prev) => ({ ...prev, [colKey]: cols! }));
                  } catch {}
                }
                if (cols)
                  cols.forEach((c) =>
                    add(
                      c,
                      monaco.languages.CompletionItemKind.Property,
                      `"${c}"`,
                    ),
                  );
                return { suggestions };
              }
            }

            // Otherwise treat as schema.table or table only
            let schema = "public";
            let table = "";
            // If right is empty, left might be schema, suggest tables in schema
            if (right.length === 0) {
              schema = left;
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
                  const placeholder = "${1:" + alias + "}";
                  add(
                    `${schema}.${tname} ${alias}`,
                    monaco.languages.CompletionItemKind.Field,
                    `"${schema}"."${tname}" ${placeholder}`,
                    true,
                  );
                }
              }
              return { suggestions };
            }

            // left is schema or table, right is table prefix or column prefix; try schema.table first
            schema = left;
            table = right;
            let resolvedSchema = schema;
            let resolvedTable = table;
            // If schema.table columns are requested, fetch
            if (table && schema) {
              const colKey = `${projectId}::${resolvedSchema}::${resolvedTable}`;
              let cols = columnsRef.current[colKey];
              if (!cols) {
                try {
                  cols = await pgsqlLoadColumns(
                    projectId,
                    resolvedSchema,
                    resolvedTable,
                  );
                  columnsRef.current[colKey] = cols;
                  setColumns((prev) => ({ ...prev, [colKey]: cols! }));
                } catch {}
              }
              if (cols)
                cols.forEach((c) =>
                  add(
                    c,
                    monaco.languages.CompletionItemKind.Property,
                    `"${c}"`,
                  ),
                );
              return { suggestions };
            }
          }
        }

        // If in FROM or JOIN context, suggest schema-qualified tables
        const fromCtx = /(from|join)\s+([A-Za-z0-9_\"\.]*)$/.exec(lowCtx);
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
                const placeholder = "${1:" + alias + "}";
                add(
                  `${schema}.${tname} ${alias}`,
                  monaco.languages.CompletionItemKind.Field,
                  `"${schema}"."${tname}" ${placeholder}`,
                  true,
                );
              }
          }
          return { suggestions };
        }

        // Fallback: suggest schemas and basic tables from cached schemas
        const projSchemas = schemasRef.current[projectId] || [];
        projSchemas.forEach((s) =>
          add(s, monaco.languages.CompletionItemKind.Module, `"${s}"`),
        );
        return { suggestions };
      },
    });
  }

  // Load initial data
  useEffect(() => {
    (async () => {
      setProjects(await getProjects());
      setQueries(await getQueries());
    })();
  }, []);

  // Global key handler as a fallback (Cmd+Enter on macOS / Ctrl+Enter elsewhere)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
      if (isCmdEnter) {
        e.preventDefault();
        void runQuery();
      }
    };
    // Use capture so we receive the event even if Monaco stops propagation
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  // Temporary: react-use hook to ensure Cmd/Ctrl+Enter runs even if Monaco swallows the event
  useKeyPressEvent("Enter", (e) => {
    const ev = e as unknown as KeyboardEvent;
    if (ev.metaKey || ev.ctrlKey) {
      ev.preventDefault();
      void runQuery();
    }
  });

  const reloadProjects = useCallback(
    async () => setProjects(await getProjects()),
    [],
  );
  const reloadQueries = useCallback(
    async () => setQueries(await getQueries()),
    [],
  );

  // Project actions
  const onAddProject = useCallback(
    async (payload: {
      project_id: string;
      user: string;
      password: string;
      database: string;
      host: string;
      port: string;
    }) => {
      const details = [
        "PGSQL",
        payload.user,
        payload.password,
        payload.database,
        payload.host,
        payload.port,
      ];
      await insertProject(payload.project_id, details);
      await reloadProjects();
    },
    [reloadProjects],
  );

  const onDeleteProject = useCallback(
    async (project_id: string) => {
      await deleteProject(project_id);
      await reloadProjects();
      setStatus((s) => ({
        ...s,
        [project_id]: ProjectConnectionStatus.Disconnected,
      }));
    },
    [reloadProjects],
  );

  const onConnect = useCallback(
    async (project_id: string) => {
      const d = projects[project_id];
      if (!d) return;
      setStatus((s) => ({
        ...s,
        [project_id]: ProjectConnectionStatus.Connecting,
      }));
      const key: [string, string, string, string, string] = [
        d[1],
        d[2],
        d[3],
        d[4],
        d[5],
      ];
      try {
        const st = await pgsqlConnector(project_id, key);
        setStatus((s) => ({ ...s, [project_id]: st }));
        if (st === ProjectConnectionStatus.Connected) {
          const sc = await pgsqlLoadSchemas(project_id);
          setSchemas((prev) => ({ ...prev, [project_id]: sc }));
        }
      } catch {
        setStatus((s) => ({
          ...s,
          [project_id]: ProjectConnectionStatus.Failed,
        }));
      }
    },
    [projects],
  );

  const onOpenProjectTab = useCallback((project_id: string) => {
    setTabs((ts) => {
      const newTab: Tab = {
        id: ts.length + 1,
        projectId: project_id,
        editorValue: "",
      };
      return [...ts, newTab];
    });
    setSelectedTab((i) => i + 1);
  }, []);

  const onLoadTables = useCallback(
    async (project_id: string, schema: string) => {
      const key = `${project_id}::${schema}`;
      if (tables[key]) return;
      const rows = await pgsqlLoadTables(project_id, schema);
      setTables((t) => ({ ...t, [key]: rows }));
    },
    [tables],
  );

  const onOpenDefaultTableQuery = useCallback(
    async (project_id: string, schema: string, table: string) => {
      const sql = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
      setTabs((ts) => {
        const newTab: Tab = {
          id: ts.length + 1,
          projectId: project_id,
          editorValue: sql,
        };
        return [...ts, newTab];
      });
      setSelectedTab((i) => i + 1);
    },
    [],
  );

  const runQuery = useCallback(async () => {
    if (!activeProject || !activeTab) return;
    const [cols, rows, time] = await pgsqlRunQuery(
      activeProject,
      activeTab.editorValue,
    );
    setTabs((ts) => {
      const copy = ts.slice();
      copy[selectedTab] = {
        ...copy[selectedTab],
        result: { columns: cols, rows, time },
      };
      return copy;
    });
    setSelectedRow(0);
  }, [activeProject, activeTab, selectedTab]);

  const saveQuery = useCallback(
    async (title: string) => {
      if (!activeProject) return;
      const driver = "PGSQL";
      const queryId = `${activeProject}:${activeDatabase}:${driver}:${title}`;
      await insertQuery(queryId, activeTab?.editorValue ?? "");
      await reloadQueries();
    },
    [activeProject, activeDatabase, activeTab?.editorValue, reloadQueries],
  );

  // UI Components
  const ProjectList = useMemo(() => {
    const entries = Object.entries(projects);
    if (!entries.length)
      return <div>No projects yet. Click "+" to add one.</div>;

    return (
      <div>
        {entries.map(([project_id, d]) => {
          const st = status[project_id] ?? ProjectConnectionStatus.Disconnected;
          const projectSchemas = schemas[project_id] ?? [];
          return (
            <div
              key={project_id}
              style={{
                paddingBottom: 8,
                borderBottom: "1px solid #eee",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => onConnect(project_id)}
                  disabled={st === ProjectConnectionStatus.Connecting}
                >
                  {st === ProjectConnectionStatus.Connected
                    ? "🟢"
                    : st === ProjectConnectionStatus.Connecting
                      ? "⏳"
                      : "🔴"}{" "}
                  {project_id}
                </button>
                <div>
                  <button
                    title="Open tab"
                    onClick={() => onOpenProjectTab(project_id)}
                    style={{ marginRight: 8 }}
                  >
                    🗂️
                  </button>
                  <button
                    title="Delete project"
                    onClick={() => onDeleteProject(project_id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {st === ProjectConnectionStatus.Connected && (
                <div style={{ paddingLeft: 12, marginTop: 6 }}>
                  {projectSchemas.length === 0 ? (
                    <button onClick={() => onConnect(project_id)}>
                      Load Schemas
                    </button>
                  ) : (
                    <div>
                      {projectSchemas.map((schema) => {
                        const key = `${project_id}::${schema}`;
                        const t = tables[key];
                        return (
                          <div key={schema} style={{ marginBottom: 6 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <strong>{schema}</strong>
                              {!t ? (
                                <button
                                  onClick={() =>
                                    onLoadTables(project_id, schema)
                                  }
                                >
                                  Load tables
                                </button>
                              ) : null}
                            </div>
                            {t && (
                              <ul style={{ margin: "4px 0 0 12px" }}>
                                {t.map(([tableName, size]) => (
                                  <li key={tableName}>
                                    <button
                                      onClick={() =>
                                        onOpenDefaultTableQuery(
                                          project_id,
                                          schema,
                                          tableName,
                                        )
                                      }
                                    >
                                      {tableName} <small>({size})</small>
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
    );
  }, [
    projects,
    status,
    schemas,
    tables,
    onConnect,
    onOpenProjectTab,
    onDeleteProject,
    onLoadTables,
    onOpenDefaultTableQuery,
  ]);

  const SavedQueries = useMemo(() => {
    const entries = Object.entries(queries);
    if (!entries.length) return null;
    return (
      <div>
        <h4>Saved Queries</h4>
        <ul>
          {entries.map(([id, sql]) => (
            <li key={id} style={{ marginBottom: 6 }}>
              <code style={{ fontSize: 12 }}>{id}</code>
              <div>
                <button
                  onClick={() => {
                    setTabs((ts) => [
                      ...ts,
                      { id: ts.length + 1, editorValue: sql },
                    ]);
                    setSelectedTab((i) => i + 1);
                  }}
                  style={{ marginRight: 8 }}
                >
                  Open
                </button>
                <button
                  onClick={async () => {
                    await deleteQuery(id);
                    await reloadQueries();
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }, [queries, reloadQueries]);

  // Add project modal (simple)
  const [showAdd, setShowAdd] = useState(false);
  const [newProject, setNewProject] = useState({
    project_id: "",
    user: "",
    password: "",
    database: "",
    host: "",
    port: "5432",
  });

  return (
    <div>
      {/* Fixed Sidebar */}
      <div className="fixed inset-y-0 left-0 w-[320px] border-r border-neutral-200 p-3 bg-white overflow-auto flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
            <h3 className="m-0 font-semibold">Projects</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
            >
              ＋
            </Button>
          </div>
          <div className="mt-3">{ProjectList}</div>
        </div>
        <div className="mt-3">{SavedQueries}</div>
      </div>

      {/* Main Content */}
      <div className="ml-[320px] h-screen flex flex-col">
        {/* Tabs Header */}
        <div className="flex gap-2 items-center border-b border-neutral-200 p-2 bg-[#fafafa] sticky top-0 z-10">
          {tabs.map((t, idx) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-md ${idx === selectedTab ? "bg-gray-200" : ""}`}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTab(idx)}
              >
                Tab {idx + 1}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTabs((ts) => ts.filter((_, i) => i !== idx))}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setTabs((ts) => [...ts, { id: ts.length + 1, editorValue: "" }])
            }
          >
            ＋
          </Button>
        </div>

        {/* Editor + actions */}
        <div className="relative h-80 border-b border-neutral-200">
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2 bg-gray-50">
            <div>
              {activeProject ? (
                <span className="px-2 py-1 border border-neutral-200 bg-white inline-block">
                  {activeProject}
                </span>
              ) : (
                <span className="text-gray-500">No project selected</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const title = prompt("Query title?");
                  if (title) void saveQuery(title);
                }}
              >
                Save Query
              </Button>
              <Button size="sm" onClick={async () => await runQuery()}>
                Run (⌘+Enter)
              </Button>
            </div>
          </div>
          <Editor
            height="100%"
            defaultLanguage="pgsql"
            language="pgsql"
            beforeMount={(monaco) => {
              // Register completion provider that suggests schemas, tables and columns
              registerContextAwareCompletions(monaco);
            }}
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              quickSuggestions: { other: true, comments: false, strings: true },
              suggestOnTriggerCharacters: true,
            }}
            value={activeTab?.editorValue}
            onChange={(v) => {
              const value = v ?? "";
              setTabs((ts) => {
                const copy = ts.slice();
                copy[selectedTab] = {
                  ...copy[selectedTab],
                  editorValue: value,
                };
                return copy;
              });
            }}
            onMount={(editor, monaco) => {
              // Cmd/Ctrl + Enter to run
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => void runQuery(),
              );
              // Provide a palette action as a fallback
              editor.addAction({
                id: "run-query",
                label: "Run Query",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                run: () => void runQuery(),
              });
              // Fallback: capture key chord directly via keydown
              editor.onKeyDown((e) => {
                if (e.equals(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter)) {
                  e.preventDefault();
                  void runQuery();
                }
              });
            }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {!activeTab?.result ? (
            <div className="flex items-center justify-center p-4 text-gray-600">
              No data to display
            </div>
          ) : (
            <div className="p-2 h-full flex flex-col">
              <div className="mb-2 text-xs text-gray-600 flex items-center justify-between">
                <span>Time: {activeTab.result.time.toFixed(0)} ms</span>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === "record" ? "default" : "outline"}
                    size="sm"
                    disabled={!activeTab.result.rows.length}
                    onClick={() => setViewMode("record")}
                  >
                    Record
                  </Button>
                </div>
              </div>

              {viewMode === "grid" ? (
                <div className="overflow-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {activeTab.result.columns.map((c) => (
                          <th
                            key={c}
                            className="text-left border-b border-neutral-300 px-2 py-1"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab.result.rows.map((r, i) => (
                        <tr
                          key={i}
                          className={`${selectedRow === i ? "bg-gray-100" : ""} hover:bg-gray-50 cursor-pointer`}
                          onClick={() => setSelectedRow(i)}
                        >
                          {r.map((cell, j) => (
                            <td
                              key={j}
                              className="border-b border-neutral-200 px-2 py-1 whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  {activeTab.result.rows.length === 0 ? (
                    <div className="flex items-center justify-center p-4 text-gray-600">
                      No row selected
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedRow((i) => Math.max(0, i - 1))
                          }
                        >
                          Prev
                        </Button>
                        <span className="text-sm text-gray-600">
                          Row {selectedRow + 1} of{" "}
                          {activeTab.result.rows.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedRow((i) =>
                              Math.min(activeTab.result.rows.length - 1, i + 1),
                            )
                          }
                        >
                          Next
                        </Button>
                      </div>
                      <table className="w-full border-collapse">
                        <tbody>
                          {activeTab.result.columns.map((col, idx) => (
                            <tr key={col}>
                              <td className="w-1/3 border-b border-neutral-200 px-2 py-1 font-medium text-gray-700">
                                {col}
                              </td>
                              <td className="border-b border-neutral-200 px-2 py-1">
                                {activeTab.result!.rows[selectedRow]?.[idx] ??
                                  ""}
                              </td>
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

      {/* Simple modal for adding project */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 mt-2">
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="project"
              value={newProject.project_id}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, project_id: e.target.value }))
              }
            />
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="username"
              value={newProject.user}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, user: e.target.value }))
              }
            />
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="password"
              type="password"
              value={newProject.password}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, password: e.target.value }))
              }
            />
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="database"
              value={newProject.database}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, database: e.target.value }))
              }
            />
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="host"
              value={newProject.host}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, host: e.target.value }))
              }
            />
            <input
              className="border border-neutral-200 rounded px-2 py-1"
              placeholder="port"
              value={newProject.port}
              onChange={(e) =>
                setNewProject((p) => ({ ...p, port: e.target.value }))
              }
            />
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !newProject.project_id ||
                !newProject.user ||
                !newProject.password ||
                !newProject.database ||
                !newProject.host ||
                !newProject.port
              }
              onClick={async () => {
                await onAddProject(newProject);
                setShowAdd(false);
                setNewProject({
                  project_id: "",
                  user: "",
                  password: "",
                  database: "",
                  host: "",
                  port: "5432",
                });
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
