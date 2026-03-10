import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
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

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    workspaces: [],
    loaded: false,

    load: async () => {
      const rows = await workspaceLoadAll();
      set({
        workspaces: rows.map(([name, tabs]) => ({ name, tabs })),
        loaded: true,
      });
    },

    save: async (name, tabsJson) => {
      await workspaceSave(name, tabsJson);
      const rows = await workspaceLoadAll();
      set({
        workspaces: rows.map(([n, tabs]) => ({ name: n, tabs })),
      });
    },

    remove: async (name) => {
      await workspaceDelete(name);
      set((s) => {
        s.workspaces = s.workspaces.filter((w) => w.name !== name);
      });
    },
  })),
);
