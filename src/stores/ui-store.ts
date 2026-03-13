import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { QueryResult } from "@/types";

interface PinnedResult {
  columns: string[];
  rows: string[][];
  label: string;
}

interface UIState {
  theme: "light" | "dark";
  sidebarWidth: number;
  editorHeight: number;
  connectionModalOpen: boolean;
  viewMode: "grid" | "record";
  selectedRow: number;
  pinnedResult: PinnedResult | null;
  aiPanelOpen: boolean;
  aiPanelWidth: number;

  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setSidebarWidth: (delta: number) => void;
  setEditorHeight: (delta: number) => void;
  setConnectionModalOpen: (open: boolean) => void;
  setViewMode: (mode: "grid" | "record") => void;
  setSelectedRow: (row: number | ((prev: number) => number)) => void;
  pinResult: (result: QueryResult, label: string) => void;
  clearPinnedResult: () => void;
  toggleAIPanel: () => void;
  setAIPanelWidth: (delta: number) => void;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    theme: "light",
    sidebarWidth: 280,
    editorHeight: 50,
    connectionModalOpen: false,
    viewMode: "grid",
    selectedRow: 0,
    pinnedResult: null,
    aiPanelOpen: false,
    aiPanelWidth: 400,

    toggleTheme: () => {
      set((s) => {
        s.theme = s.theme === "light" ? "dark" : "light";
        if (s.theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      });
    },

    setTheme: (theme) => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      set({ theme });
    },

    setSidebarWidth: (delta) => {
      set((s) => {
        s.sidebarWidth = Math.max(180, Math.min(700, s.sidebarWidth + delta));
      });
    },

    setEditorHeight: (delta) => {
      const containerHeight = window.innerHeight - 48 - 24;
      const deltaPercent = (delta / containerHeight) * 100;
      set((s) => {
        s.editorHeight = Math.max(
          20,
          Math.min(80, s.editorHeight + deltaPercent),
        );
      });
    },

    setConnectionModalOpen: (open) => set({ connectionModalOpen: open }),

    setViewMode: (mode) => set({ viewMode: mode }),

    setSelectedRow: (row) => {
      set((s) => {
        s.selectedRow = typeof row === "function" ? row(s.selectedRow) : row;
      });
    },

    pinResult: (result, label) => {
      set((s) => {
        s.pinnedResult = { columns: result.columns, rows: result.rows, label };
      });
    },

    clearPinnedResult: () => set({ pinnedResult: null }),

    toggleAIPanel: () => {
      set((s) => {
        s.aiPanelOpen = !s.aiPanelOpen;
      });
    },

    setAIPanelWidth: (delta) => {
      set((s) => {
        s.aiPanelWidth = Math.max(300, Math.min(800, s.aiPanelWidth + delta));
      });
    },
  })),
);
