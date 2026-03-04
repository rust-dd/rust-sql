import { create } from "zustand";

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

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],

  addEntry: (entry) => {
    set((s) => ({
      entries: [
        { ...entry, id: `hist-${++historyId}` },
        ...s.entries,
      ].slice(0, 500), // keep last 500
    }));
  },

  clearHistory: () => set({ entries: [] }),
}));
