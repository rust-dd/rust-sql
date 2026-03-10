import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { getQueries, insertQuery, deleteQuery } from "@/tauri";

export interface SavedQuery {
  id: string;
  projectId: string;
  database: string;
  driver: string;
  title: string;
  sql: string;
}

function parseQueryId(id: string): {
  projectId: string;
  database: string;
  driver: string;
  title: string;
} | null {
  const parts = id.split(":");
  if (parts.length < 4) return null;
  return {
    projectId: parts[0],
    database: parts[1],
    driver: parts[2],
    title: parts.slice(3).join(":"),
  };
}

interface QueryStore {
  queries: SavedQuery[];
  loaded: boolean;
  loadQueries: () => Promise<void>;
  saveQuery: (
    projectId: string,
    database: string,
    driver: string,
    title: string,
    sql: string,
  ) => Promise<void>;
  removeQuery: (id: string) => Promise<void>;
}

export const useQueryStore = create<QueryStore>()(
  immer((set) => ({
    queries: [],
    loaded: false,

    loadQueries: async () => {
      const raw = await getQueries();
      const queries: SavedQuery[] = [];
      for (const [id, sql] of Object.entries(raw)) {
        const parsed = parseQueryId(id);
        if (parsed) {
          queries.push({ id, sql, ...parsed });
        }
      }
      set({ queries, loaded: true });
    },

    saveQuery: async (projectId, database, driver, title, sql) => {
      const id = `${projectId}:${database}:${driver}:${title}`;
      await insertQuery(id, sql);
      set((s) => {
        s.queries = [
          ...s.queries.filter((q) => q.id !== id),
          { id, projectId, database, driver, title, sql },
        ];
      });
    },

    removeQuery: async (id) => {
      await deleteQuery(id);
      set((s) => {
        s.queries = s.queries.filter((q) => q.id !== id);
      });
    },
  })),
);
