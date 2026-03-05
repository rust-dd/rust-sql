import { create } from "zustand";
import { workspaceSave, workspaceLoadAll, workspaceDelete } from "@/tauri";

interface WorkspaceEntry {
  name: string;
  tabs: string; // JSON string
}

interface WorkspaceState {
  workspaces: WorkspaceEntry[];
  loaded: boolean;

  load: () => Promise<void>;
  save: (name: string, tabsJson: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  workspaces: [],
  loaded: false,

  load: async () => {
    const rows = await workspaceLoadAll();
    set({
      workspaces: rows.map(([name, tabs]) => ({ name, tabs })),
      loaded: true,
    });
  },

  save: async (name: string, tabsJson: string) => {
    await workspaceSave(name, tabsJson);
    // Refresh list
    const rows = await workspaceLoadAll();
    set({
      workspaces: rows.map(([n, tabs]) => ({ name: n, tabs })),
    });
  },

  remove: async (name: string) => {
    await workspaceDelete(name);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.name !== name),
    }));
  },
}));
