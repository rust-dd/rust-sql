/**
 * Catalog snapshots the editor's language features read from.
 *
 * Deliberately not persisted: it mirrors live server state, and a stale copy
 * restored from disk would suggest columns that no longer exist. Completion
 * never awaits a load — it uses whatever is present and lets the fetch it
 * kicked off populate the next keystroke.
 */

import { create } from "zustand";
import { DriverFactory } from "@/lib/database-driver";
import type {
  Catalog,
  IndexedFunction,
  IndexedRelation,
  SchemaIndex,
} from "@/monaco/completion/types";
import { useProjectStore } from "@/stores/project-store";

function key(projectId: string, schema: string): string {
  return `${projectId}::${schema}`;
}

interface SchemaIndexState {
  indexes: Record<string, SchemaIndex>;
  loading: Record<string, boolean>;
  /** Schemas whose snapshot is known to be out of date. */
  stale: Record<string, true>;

  ensureIndex: (projectId: string, schema: string) => Promise<void>;
  invalidateProject: (projectId: string) => void;
  getIndex: (projectId: string, schema: string) => SchemaIndex | undefined;
  /** True while a snapshot is in flight, or when one has never been taken. */
  isPending: (projectId: string, schema: string) => boolean;
}

export const useSchemaIndexStore = create<SchemaIndexState>()((set, get) => ({
  indexes: {},
  loading: {},
  stale: {},

  ensureIndex: async (projectId, schema) => {
    const k = key(projectId, schema);
    const { indexes, loading, stale } = get();
    if (loading[k]) return;
    if (indexes[k] && !stale[k]) return;

    const project = useProjectStore.getState().projects[projectId];
    if (!project) return;
    const driver = DriverFactory.getDriver(project.driver);
    if (!driver.loadSchemaIndex) return;

    set((s) => ({ loading: { ...s.loading, [k]: true } }));
    try {
      const index = await driver.loadSchemaIndex(projectId, schema);
      set((s) => {
        const nextStale = { ...s.stale };
        delete nextStale[k];
        return {
          indexes: { ...s.indexes, [k]: index },
          stale: nextStale,
          loading: { ...s.loading, [k]: false },
        };
      });
    } catch {
      // A failed snapshot must not wedge the editor; the next trigger retries.
      set((s) => ({ loading: { ...s.loading, [k]: false } }));
    }
  },

  invalidateProject: (projectId) => {
    const prefix = `${projectId}::`;
    set((s) => {
      const stale = { ...s.stale };
      for (const k of Object.keys(s.indexes)) {
        if (k.startsWith(prefix)) stale[k] = true;
      }
      return { stale };
    });
  },

  getIndex: (projectId, schema) => get().indexes[key(projectId, schema)],

  isPending: (projectId, schema) => {
    const k = key(projectId, schema);
    const { indexes, loading, stale } = get();
    return loading[k] === true || !indexes[k] || stale[k] === true;
  },
}));

/**
 * A read-only view for the completion core. Reads the store once per
 * invocation and requests anything missing in the background.
 */
export function catalogFor(projectId: string, defaultSchema: string): Catalog {
  const { indexes, ensureIndex } = useSchemaIndexStore.getState();
  const projectSchemas = useProjectStore.getState().schemas[projectId] ?? [];

  const indexOf = (schema: string): SchemaIndex | undefined => {
    const index = indexes[key(projectId, schema)];
    if (!index) void ensureIndex(projectId, schema);
    return index;
  };

  return {
    defaultSchema,
    schemas: () => projectSchemas,
    relations: (schema): IndexedRelation[] => indexOf(schema ?? defaultSchema)?.relations ?? [],
    relation: (name, schema): IndexedRelation | undefined => {
      const lower = name.toLowerCase();
      if (schema) {
        return indexOf(schema)?.relations.find((r) => r.name.toLowerCase() === lower);
      }
      // Unqualified: the default schema wins, then whatever else is loaded,
      // which mirrors how a search_path lookup resolves.
      const preferred = indexOf(defaultSchema)?.relations.find(
        (r) => r.name.toLowerCase() === lower,
      );
      if (preferred) return preferred;
      for (const other of projectSchemas) {
        if (other === defaultSchema) continue;
        const found = indexes[key(projectId, other)]?.relations.find(
          (r) => r.name.toLowerCase() === lower,
        );
        if (found) return found;
      }
      return undefined;
    },
    functions: (schema): IndexedFunction[] => indexOf(schema ?? defaultSchema)?.functions ?? [],
  };
}
