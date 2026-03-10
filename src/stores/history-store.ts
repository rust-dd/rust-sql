import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface HistoryEntry {
  id: string;
  projectId: string;
  database: string;
  sql: string;
  executionTime: number;
  rowCount: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, "id">) => void;
  clearHistory: () => void;
}

let historyId = 0;

export const useHistoryStore = create<HistoryState>()(
  immer((set) => ({
    entries: [],

    addEntry: (entry) => {
      set((s) => {
        s.entries.unshift({ ...entry, id: `hist-${++historyId}` });
        s.entries.length = Math.min(s.entries.length, 500);
      });
    },

    clearHistory: () => set({ entries: [] }),
  })),
);
