import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { useProjectStore } from "@/stores/project-store";
import { useTabStore } from "@/stores/tab-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Table, Eye, FileCode, Layers, Database, Save, FolderOpen, Trash2 } from "lucide-react";

type Page = "root" | "save-workspace" | "load-workspace" | "delete-workspace";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<Page>("root");
  const [search, setSearch] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const tables = useProjectStore((s) => s.tables);
  const views = useProjectStore((s) => s.views);
  const materializedViews = useProjectStore((s) => s.materializedViews);
  const functions = useProjectStore((s) => s.functions);
  const schemas = useProjectStore((s) => s.schemas);
  const openTab = useTabStore((s) => s.openTab);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loadWorkspaces = useWorkspaceStore((s) => s.load);
  const saveWorkspace = useWorkspaceStore((s) => s.save);
  const removeWorkspace = useWorkspaceStore((s) => s.remove);
  const workspacesLoaded = useWorkspaceStore((s) => s.loaded);

  useEffect(() => {
    if (open) {
      setPage("root");
      setSearch("");
      setWorkspaceName("");
      if (!workspacesLoaded) void loadWorkspaces();
    }
  }, [open, workspacesLoaded, loadWorkspaces]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!workspaceName.trim()) return;
    const tabs = useTabStore.getState().tabs
      .filter((t) => t.type === "query")
      .map((t) => ({ title: t.title, editorValue: t.editorValue, projectId: t.projectId, type: t.type }));
    await saveWorkspace(workspaceName.trim(), JSON.stringify(tabs));
    onClose();
  }, [workspaceName, saveWorkspace, onClose]);

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-[15%] z-50 w-[560px] -translate-x-1/2 rounded-lg border border-border bg-popover shadow-2xl overflow-hidden">
        <Command
          className="flex flex-col"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (page !== "root") {
                e.preventDefault();
                setPage("root");
                setSearch("");
                setWorkspaceName("");
              } else {
                onClose();
              }
            }
          }}
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
                    else if (e.key === "Escape") { setPage("root"); setWorkspaceName(""); }
                  }}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
                />
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
              </div>
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Press Enter to save current query tabs as a workspace
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
                <div className="flex-1" />
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
              </div>
              <Command.List className="max-h-[400px] overflow-y-auto py-1">
                {workspaces.length === 0 ? (
                  <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No saved workspaces
                  </Command.Empty>
                ) : (
                  workspaces.map((ws) => (
                    <Command.Item
                      key={ws.name}
                      value={ws.name}
                      onSelect={() => {
                        if (page === "delete-workspace") void handleDeleteWorkspace(ws.name);
                        else handleLoadWorkspace(ws.tabs);
                      }}
                      className="flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
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
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder="Search tables, views, functions..."
                className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
              />
              <Command.List className="max-h-[400px] overflow-y-auto py-1">
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found
                </Command.Empty>

                {/* Workspace actions */}
                <Command.Group heading="Workspaces">
                  <Command.Item
                    value="Save Workspace"
                    onSelect={() => setPage("save-workspace")}
                    className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                  >
                    <Save className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm font-medium text-foreground">Save Workspace</span>
                      <div className="font-mono text-xs text-muted-foreground">Save current tabs as a workspace</div>
                    </div>
                  </Command.Item>
                  {workspaces.length > 0 && (
                    <>
                      <Command.Item
                        value="Load Workspace"
                        onSelect={() => setPage("load-workspace")}
                        className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-sm font-medium text-foreground">Load Workspace</span>
                          <div className="font-mono text-xs text-muted-foreground">Restore a saved workspace</div>
                        </div>
                      </Command.Item>
                      <Command.Item
                        value="Delete Workspace"
                        onSelect={() => setPage("delete-workspace")}
                        className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-sm font-medium text-foreground">Delete Workspace</span>
                          <div className="font-mono text-xs text-muted-foreground">Remove a saved workspace</div>
                        </div>
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
                          value={`${schema}.${t.name} table`}
                          onSelect={() => selectItem("table", projectId, schema, t.name)}
                          className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                        >
                          <Table className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{t.name}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">Table</span>
                            </div>
                            {t.size && <div className="font-mono text-xs text-muted-foreground truncate">{t.size}</div>}
                          </div>
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
                          value={`${schema}.${v} view`}
                          onSelect={() => selectItem("view", projectId, schema, v)}
                          className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{v}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">View</span>
                            </div>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}

                {Object.entries(materializedViews).map(([key, matViews]) => {
                  const [projectId, schema] = key.split("::");
                  if (!matViews.length) return null;
                  return (
                    <Command.Group key={`mv-${key}`} heading={`${projectId} / ${schema} Materialized Views`}>
                      {matViews.map((mv) => (
                        <Command.Item
                          key={`matview-${key}-${mv}`}
                          value={`${schema}.${mv} materialized view`}
                          onSelect={() => selectItem("matview", projectId, schema, mv)}
                          className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                        >
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{mv}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">Materialized View</span>
                            </div>
                          </div>
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
                          value={`${schema}.${fn.name} function`}
                          onSelect={() => selectItem("function", projectId, schema, fn.name)}
                          className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                        >
                          <FileCode className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{fn.name}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">Function</span>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground truncate">
                              ({fn.arguments || ""}) -&gt; {fn.returnType}
                            </div>
                          </div>
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
                          className="flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50"
                        >
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{s}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">Schema</span>
                            </div>
                          </div>
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
    </>
  );
}
