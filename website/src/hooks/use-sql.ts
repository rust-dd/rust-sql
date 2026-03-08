import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDB, resetDB } from "@/lib/pglite";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  time: number;
  error?: string;
}

/** Ensure PGlite is initialized */
export function useDBReady() {
  return useQuery({
    queryKey: ["pglite-init"],
    queryFn: async () => {
      await getDB();
      return true;
    },
    staleTime: Infinity,
    retry: 1,
  });
}

/** Load table list from pg_catalog */
export function useTables() {
  return useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const db = await getDB();
      const res = await db.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );
      return res.rows.map((r) => r.table_name);
    },
    staleTime: Infinity,
  });
}

/** Load columns for a table */
export function useColumns(table: string | null) {
  return useQuery({
    queryKey: ["columns", table],
    queryFn: async () => {
      if (!table) return [];
      const db = await getDB();
      const res = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );
      return res.rows;
    },
    enabled: !!table,
    staleTime: Infinity,
  });
}

/** Execute a SQL query */
export function useExecuteSQL() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sql: string): Promise<QueryResult> => {
      const start = performance.now();
      try {
        const db = await getDB();
        const res = await db.query(sql);
        const elapsed = performance.now() - start;
        const columns = res.fields.map((f) => f.name);
        return {
          columns,
          rows: res.rows as Record<string, unknown>[],
          rowCount: res.rows.length,
          time: elapsed,
        };
      } catch (err: unknown) {
        const elapsed = performance.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        return {
          columns: ["Error"],
          rows: [{ Error: message }],
          rowCount: 0,
          time: elapsed,
          error: message,
        };
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

/** Reset database to initial state */
export function useResetDB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await resetDB();
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}
