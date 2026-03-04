import { create } from "zustand";

interface UIState {
  theme: "light" | "dark";
  sidebarWidth: number;
  editorHeight: number;
  connectionModalOpen: boolean;
  viewMode: "grid" | "record";
  selectedRow: number;

  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setSidebarWidth: (delta: number) => void;
  setEditorHeight: (delta: number) => void;
  setConnectionModalOpen: (open: boolean) => void;
  setViewMode: (mode: "grid" | "record") => void;
  setSelectedRow: (row: number | ((prev: number) => number)) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "light",
  sidebarWidth: 280,
  editorHeight: 50,
  connectionModalOpen: false,
  viewMode: "grid",
  selectedRow: 0,

  toggleTheme: () => {
    set((s) => {
      const newTheme = s.theme === "light" ? "dark" : "light";
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { theme: newTheme };
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

  setSidebarWidth: (delta: number) => {
    set((s) => ({
      sidebarWidth: Math.max(180, Math.min(700, s.sidebarWidth + delta)),
    }));
  },

  setEditorHeight: (delta: number) => {
    const containerHeight = window.innerHeight - 48 - 24; // top bar + status bar
    const deltaPercent = (delta / containerHeight) * 100;
    set((s) => ({
      editorHeight: Math.max(20, Math.min(80, s.editorHeight + deltaPercent)),
    }));
  },

  setConnectionModalOpen: (open) => set({ connectionModalOpen: open }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedRow: (row) => {
    set((s) => ({
      selectedRow: typeof row === "function" ? row(s.selectedRow) : row,
    }));
  },
}));
