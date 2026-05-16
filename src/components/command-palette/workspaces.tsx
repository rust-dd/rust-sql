import { Command } from "cmdk";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import type { Page } from "./types";

type WorkspaceStateWorkspaces = ReturnType<typeof useWorkspaceStore.getState>["workspaces"];

export function SaveWorkspacePage({
  workspaceName,
  setWorkspaceName,
  setPage,
  handleSaveWorkspace,
}: {
  workspaceName: string;
  setWorkspaceName: (v: string) => void;
  setPage: (p: Page) => void;
  handleSaveWorkspace: () => Promise<void>;
}) {
  return (
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
  );
}

export function LoadOrDeleteWorkspacePage({
  page,
  workspaces,
  handleDeleteWorkspace,
  handleLoadWorkspace,
}: {
  page: Page;
  workspaces: WorkspaceStateWorkspaces;
  handleDeleteWorkspace: (name: string) => Promise<void>;
  handleLoadWorkspace: (tabsJson: string) => void;
}) {
  return (
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
  );
}

export function WorkspacesGroup({
  setPage,
  workspaces,
}: {
  setPage: (p: Page) => void;
  workspaces: WorkspaceStateWorkspaces;
}) {
  return (
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
  );
}
