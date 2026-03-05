import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useQueryStore } from "@/stores/query-store";
import { format as formatSQL } from "sql-formatter";
import {
  Table, Eye, FileCode, Layers, Database, Save, FolderOpen, Trash2,
  Plus, Play, GitBranch, AlignLeft, Moon, Sun, Terminal, Activity,
  Network, XCircle, Pin, PinOff,
} from "lucide-react";

type Page = "root" | "save-workspace" | "load-workspace" | "delete-workspace" | "save-query";

export function CommandPalette({
  open, onClose, onExecute, onExplain,
}: {
  open: boolean;
  onClose: () => void;
  onExecute: () => void;
  onExplain: () => void;
}) {
  const [page, setPage] = useState<Page>("root");
  const [workspaceName, setWorkspaceName] = useState("");
  const [queryName, setQueryName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const tables = useProjectStore((s) => s.tables);
  const views = useProjectStore((s) => s.views);
  const materializedViews = useProjectStore((s) => s.materializedViews);
  const functions = useProjectStore((s) => s.functions);
  const schemas = useProjectStore((s) => s.schemas);
  const projects = useProjectStore((s) => s.projects);
  const status = useProjectStore((s) => s.status);
  const connectProject = useProjectStore((s) => s.connect);

  const openTab = useTabStore((s) => s.openTab);
  const activeTab = useActiveTab();

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setConnectionModalOpen = useUIStore((s) => s.setConnectionModalOpen);
  const pinnedResult = useUIStore((s) => s.pinnedResult);
  const clearPinnedResult = useUIStore((s) => s.clearPinnedResult);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loadWorkspaces = useWorkspaceStore((s) => s.load);
  const saveWorkspace = useWorkspaceStore((s) => s.save);
  const removeWorkspace = useWorkspaceStore((s) => s.remove);
  const workspacesLoaded = useWorkspaceStore((s) => s.loaded);

  const saveQueryAction = useQueryStore((s) => s.saveQuery);

  useEffect(() => {
    if (open) {
      setPage("root");
      setWorkspaceName("");
      setQueryName("");
      if (!workspacesLoaded) void loadWorkspaces();
    }
  }, [open, workspacesLoaded, loadWorkspaces]);

  // Close on Escape at root page
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (page !== "root") {
          e.preventDefault();
          e.stopPropagation();
          setPage("root");
          setWorkspaceName("");
          setQueryName("");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, page, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!workspaceName.trim()) return;
    const tabs = useTabStore.getState().tabs
      .filter((t) => t.type === "query")
      .map((t) => ({ title: t.title, editorValue: t.editorValue, projectId: t.projectId, type: t.type }));
    await saveWorkspace(workspaceName.trim(), JSON.stringify(tabs));
    onClose();
  }, [workspaceName, saveWorkspace, onClose]);

  const handleSaveQuery = useCallback(async () => {
    if (!queryName.trim()) return;
    const tab = useTabStore.getState().tabs[useTabStore.getState().selectedTabIndex];
    if (!tab?.projectId || !tab.editorValue?.trim()) return;
    const d = useProjectStore.getState().projects[tab.projectId];
    if (!d) return;
    await saveQueryAction(tab.projectId, d.database, d.driver, queryName.trim(), tab.editorValue);
    onClose();
  }, [queryName, saveQueryAction, onClose]);

  const handleLoadWorkspace = useCallback((tabsJson: string) => {
    try {
      const tabs = JSON.parse(tabsJson) as { title: string; editorValue: string; projectId?: string; type: string }[];
      const store = useTabStore.getState();
      for (const tab of tabs) {
        store.openTab(tab.projectId, tab.editorValue);
      }
    } catch { /* ignore parse errors */ }
    onClose();
  }, [onClose]);

  const handleDeleteWorkspace = useCallback(async (name: string) => {
    await removeWorkspace(name);
    if (workspaces.length <= 1) setPage("root");
  }, [removeWorkspace, workspaces.length]);

  const selectItem = useCallback((type: string, projectId: string, schema: string, name: string) => {
    onClose();
    if (type === "table" || type === "view" || type === "matview") {
      openTab(projectId, `SELECT * FROM "${schema}"."${name}" LIMIT 100;`);
    } else if (type === "function") {
      openTab(projectId, `-- Function: ${schema}.${name}\nSELECT pg_get_functiondef(p.oid)\nFROM pg_proc p\nJOIN pg_namespace n ON n.oid = p.pronamespace\nWHERE n.nspname = '${schema}' AND p.proname = '${name}'\nLIMIT 1;`);
    } else if (type === "schema") {
      openTab(projectId, `-- Schema: ${name}\n`);
    }
  }, [openTab, onClose]);

  const formatQuery = useCallback(() => {
    const { tabs, selectedTabIndex: idx } = useTabStore.getState();
    const tab = tabs[idx];
    if (!tab?.editorValue?.trim()) return;
    try {
      const formatted = formatSQL(tab.editorValue, { language: "postgresql", tabWidth: 2, keywordCase: "upper" });
      useTabStore.getState().updateContent(idx, formatted);
    } catch { /* ignore */ }
    onClose();
  }, [onClose]);

  if (!open) return null;

  const activeProject = activeTab?.projectId;
  const hasQuery = !!activeTab?.editorValue?.trim();

  return createPortal(
    <>
      <div className="cmdk-overlay" />
      <div ref={containerRef} className="cmdk-content">
        <Command
          label="Command palette"
          onKeyDown={(e) => {
            if (e.key === "Backspace" && page !== "root") {
              const input = e.currentTarget.querySelector("[cmdk-input]") as HTMLInputElement | null;
              if (input && input.value === "") {
                e.preventDefault();
                setPage("root");
                setWorkspaceName("");
                setQueryName("");
              }
            }
          }}
          loop
        >
          {page === "save-workspace" ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Save className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Workspace name..."
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveWorkspace();
                    else if (e.key === "Escape") { e.stopPropagation(); setPage("root"); setWorkspaceName(""); }
                  }}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
                />
              </div>
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Press Enter to save current query tabs as a workspace
              </div>
            </>
          ) : page === "save-query" ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Save className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Query name..."
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveQuery();
                    else if (e.key === "Escape") { e.stopPropagation(); setPage("root"); setQueryName(""); }
                  }}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
                />
              </div>
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Press Enter to save the current query
              </div>
            </>
          ) : page === "load-workspace" || page === "delete-workspace" ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                {page === "delete-workspace"
                  ? <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm text-foreground font-mono">
                  {page === "delete-workspace" ? "Delete Workspace" : "Load Workspace"}
                </span>
              </div>
              <Command.List>
                {workspaces.length === 0 ? (
                  <Command.Empty>No saved workspaces</Command.Empty>
                ) : (
                  workspaces.map((ws) => (
                    <Command.Item
                      key={ws.name}
                      value={ws.name}
                      onSelect={() => {
                        if (page === "delete-workspace") void handleDeleteWorkspace(ws.name);
                        else handleLoadWorkspace(ws.tabs);
                      }}
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-sm font-medium text-foreground">{ws.name}</span>
                        <div className="font-mono text-xs text-muted-foreground">
                          {(() => { try { return `${JSON.parse(ws.tabs).length} tabs`; } catch { return ""; } })()}
                        </div>
                      </div>
                      {page === "delete-workspace" && <Trash2 className="h-4 w-4 text-destructive shrink-0" />}
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </>
          ) : (
            <>
              <Command.Input placeholder="Search commands, tables, views..." autoFocus />
              <Command.List>
                <Command.Empty>No results found</Command.Empty>

                {/* Actions */}
                <Command.Group heading="Actions">
                  <Command.Item value="New Connection" onSelect={() => { onClose(); setConnectionModalOpen(true); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span>New Connection</span>
                    <span className="cmdk-meta">Connection</span>
                  </Command.Item>
                  <Command.Item value="New Query Tab" onSelect={() => { onClose(); useTabStore.getState().openTab(activeProject); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span>New Query Tab</span>
                  </Command.Item>
                  <Command.Item value="Open Terminal" onSelect={() => { onClose(); useTabStore.getState().openTerminalTab(); }}>
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <span>Open Terminal</span>
                    <span className="cmdk-detail">{navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+`</span>
                  </Command.Item>
                  {activeProject && hasQuery && (
                    <>
                      <Command.Item value="Execute Query" onSelect={() => { onClose(); onExecute(); }}>
                        <Play className="h-4 w-4 text-muted-foreground" />
                        <span>Execute Query</span>
                        <span className="cmdk-detail">{navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter</span>
                      </Command.Item>
                      <Command.Item value="Explain Query" onSelect={() => { onClose(); onExplain(); }}>
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span>Explain Query</span>
                        <span className="cmdk-detail">{navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Shift+Enter</span>
                      </Command.Item>
                      <Command.Item value="Cancel Query" onSelect={() => { onClose(); }}>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span>Cancel Query</span>
                        <span className="cmdk-detail">{navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+.</span>
                      </Command.Item>
                    </>
                  )}
                  {hasQuery && (
                    <>
                      <Command.Item value="Format SQL" onSelect={formatQuery}>
                        <AlignLeft className="h-4 w-4 text-muted-foreground" />
                        <span>Format SQL</span>
                      </Command.Item>
                      <Command.Item value="Save Query" onSelect={() => setPage("save-query")}>
                        <Save className="h-4 w-4 text-muted-foreground" />
                        <span>Save Query</span>
                      </Command.Item>
                    </>
                  )}
                  <Command.Item value="Toggle Theme Dark Light" onSelect={() => { onClose(); toggleTheme(); }}>
                    {theme === "light"
                      ? <Moon className="h-4 w-4 text-muted-foreground" />
                      : <Sun className="h-4 w-4 text-muted-foreground" />}
                    <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
                  </Command.Item>
                  {pinnedResult ? (
                    <Command.Item value="Clear Pinned Result" onSelect={() => { onClose(); clearPinnedResult(); }}>
                      <PinOff className="h-4 w-4 text-muted-foreground" />
                      <span>Clear Pinned Result</span>
                    </Command.Item>
                  ) : activeTab?.result && (
                    <Command.Item value="Pin Current Result" onSelect={() => {
                      onClose();
                      const tab = useTabStore.getState().tabs[useTabStore.getState().selectedTabIndex];
                      if (tab?.result) useUIStore.getState().pinResult(tab.result, tab.editorValue.slice(0, 60));
                    }}>
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <span>Pin Current Result</span>
                    </Command.Item>
                  )}
                </Command.Group>

                {/* Connections */}
                {Object.keys(projects).length > 0 && (
                  <Command.Group heading="Connections">
                    {Object.entries(projects).map(([id, details]) => {
                      const connected = status[id] === "Connected";
                      return (
                        <Command.Item
                          key={`conn-${id}`}
                          value={`${id} ${details.database} ${details.host} connection`}
                          onSelect={() => {
                            onClose();
                            if (!connected) void connectProject(id);
                          }}
                        >
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>{id}</span>
                          <span className="cmdk-detail">{details.host}:{details.port}/{details.database}</span>
                          <span className={`cmdk-meta ${connected ? "!bg-success/20 !text-success" : ""}`}>
                            {connected ? "Connected" : "Connect"}
                          </span>
                        </Command.Item>
                      );
                    })}
                    {Object.entries(projects).map(([id]) => {
                      const connected = status[id] === "Connected";
                      if (!connected) return null;
                      return (
                        <Command.Item
                          key={`monitor-${id}`}
                          value={`${id} performance monitor`}
                          onSelect={() => { onClose(); useTabStore.getState().openMonitorTab(id); }}
                        >
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span>Monitor {id}</span>
                          <span className="cmdk-meta">Performance</span>
                        </Command.Item>
                      );
                    })}
                    {Object.entries(schemas).map(([projectId, projectSchemas]) =>
                      projectSchemas.map((s) => (
                        <Command.Item
                          key={`erd-${projectId}-${s}`}
                          value={`${projectId} ${s} ERD diagram`}
                          onSelect={() => { onClose(); useTabStore.getState().openERDTab(projectId, s); }}
                        >
                          <Network className="h-4 w-4 text-muted-foreground" />
                          <span>ERD {projectId}/{s}</span>
                          <span className="cmdk-meta">Diagram</span>
                        </Command.Item>
                      ))
                    )}
                  </Command.Group>
                )}

                {/* Workspaces */}
                <Command.Group heading="Workspaces">
                  <Command.Item value="Save Workspace" onSelect={() => setPage("save-workspace")}>
                    <Save className="h-4 w-4 text-muted-foreground" />
                    <span>Save Workspace</span>
                  </Command.Item>
                  {workspaces.length > 0 && (
                    <>
                      <Command.Item value="Load Workspace" onSelect={() => setPage("load-workspace")}>
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span>Load Workspace</span>
                      </Command.Item>
                      <Command.Item value="Delete Workspace" onSelect={() => setPage("delete-workspace")}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                        <span>Delete Workspace</span>
                      </Command.Item>
                    </>
                  )}
                </Command.Group>

                {/* Database objects */}
                {Object.entries(tables).map(([key, schemaTables]) => {
                  const [projectId, schema] = key.split("::");
                  if (!schemaTables.length) return null;
                  return (
                    <Command.Group key={`t-${key}`} heading={`${projectId} / ${schema}`}>
                      {schemaTables.map((t) => (
                        <Command.Item
                          key={`table-${key}-${t.name}`}
                          value={`${schema} ${t.name} table`}
                          onSelect={() => selectItem("table", projectId, schema, t.name)}
                        >
                          <Table className="h-4 w-4 text-muted-foreground" />
                          <span>{t.name}</span>
                          <span className="cmdk-meta">Table</span>
                          {t.size && <span className="cmdk-detail">{t.size}</span>}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                {Object.entries(views).map(([key, schemaViews]) => {
                  const [projectId, schema] = key.split("::");
                  if (!schemaViews.length) return null;
                  return (
                    <Command.Group key={`v-${key}`} heading={`${projectId} / ${schema} Views`}>
                      {schemaViews.map((v) => (
                        <Command.Item
                          key={`view-${key}-${v}`}
                          value={`${schema} ${v} view`}
                          onSelect={() => selectItem("view", projectId, schema, v)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>{v}</span>
                          <span className="cmdk-meta">View</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                {Object.entries(materializedViews).map(([key, matViews]) => {
                  const [projectId, schema] = key.split("::");
                  if (!matViews.length) return null;
                  return (
                    <Command.Group key={`mv-${key}`} heading={`${projectId} / ${schema} Mat. Views`}>
                      {matViews.map((mv) => (
                        <Command.Item
                          key={`matview-${key}-${mv}`}
                          value={`${schema} ${mv} materialized view`}
                          onSelect={() => selectItem("matview", projectId, schema, mv)}
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span>{mv}</span>
                          <span className="cmdk-meta">Mat. View</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                {Object.entries(functions).map(([key, fns]) => {
                  const [projectId, schema] = key.split("::");
                  if (!fns.length) return null;
                  return (
                    <Command.Group key={`fn-${key}`} heading={`${projectId} / ${schema} Functions`}>
                      {fns.map((fn) => (
                        <Command.Item
                          key={`func-${key}-${fn.name}`}
                          value={`${schema} ${fn.name} function`}
                          onSelect={() => selectItem("function", projectId, schema, fn.name)}
                        >
                          <FileCode className="h-4 w-4 text-muted-foreground" />
                          <span>{fn.name}</span>
                          <span className="cmdk-meta">Function</span>
                          <span className="cmdk-detail">({fn.arguments || ""}) → {fn.returnType}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                {Object.entries(schemas).map(([projectId, projectSchemas]) => {
                  if (!projectSchemas.length) return null;
                  return (
                    <Command.Group key={`s-${projectId}`} heading={`${projectId} Schemas`}>
                      {projectSchemas.map((s) => (
                        <Command.Item
                          key={`schema-${projectId}-${s}`}
                          value={`${s} schema`}
                          onSelect={() => selectItem("schema", projectId, s, s)}
                        >
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>{s}</span>
                          <span className="cmdk-meta">Schema</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>
            </>
          )}
        </Command>
      </div>
    </>,
    document.body
  );
}
