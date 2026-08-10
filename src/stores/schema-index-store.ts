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

/**
 * Loads currently in flight, keyed the same way.
 *
 * A second request for a schema already being fetched has to wait for that
 * fetch rather than returning at once. Returning early meant a caller that
 * awaited `ensureIndex` resolved immediately whenever the connect-time warmup
 * had a load running, so it neither waited nor saw an index.
 */
const inFlight = new Map<string, Promise<void>>();

interface SchemaIndexState {
  indexes: Record<string, SchemaIndex>;
  loading: Record<string, boolean>;
  /** Schemas whose snapshot is known to be out of date. */
  stale: Record<string, true>;
  /** Schemas whose last fetch failed. Still retried, but never waited on. */
  failed: Record<string, true>;

  ensureIndex: (projectId: string, schema: string) => Promise<void>;
  invalidateProject: (projectId: string) => void;
  getIndex: (projectId: string, schema: string) => SchemaIndex | undefined;
  /** True while a snapshot is in flight, or when one has never been taken. */
  isPending: (projectId: string, schema: string) => boolean;
  /** Whether waiting for this schema is worth it, or its last fetch failed. */
  isWorthWaitingFor: (projectId: string, schema: string) => boolean;
}

export const useSchemaIndexStore = create<SchemaIndexState>()((set, get) => ({
  indexes: {},
  loading: {},
  stale: {},
  failed: {},

  ensureIndex: (projectId, schema) => {
    const k = key(projectId, schema);

    const running = inFlight.get(k);
    if (running) return running;

    const { indexes, stale } = get();
    if (indexes[k] && !stale[k]) return Promise.resolve();

    const project = useProjectStore.getState().projects[projectId];
    if (!project) return Promise.resolve();
    const driver = DriverFactory.getDriver(project.driver);
    if (!driver.loadSchemaIndex) return Promise.resolve();

    set((s) => ({ loading: { ...s.loading, [k]: true } }));

    const load = driver
      .loadSchemaIndex(projectId, schema)
      .then((index) => {
        set((s) => {
          const nextStale = { ...s.stale };
          const nextFailed = { ...s.failed };
          delete nextStale[k];
          delete nextFailed[k];
          return {
            indexes: { ...s.indexes, [k]: index },
            stale: nextStale,
            failed: nextFailed,
            loading: { ...s.loading, [k]: false },
          };
        });
      })
      .catch((error) => {
        // Swallowing this left completion waiting on a snapshot that was never
        // coming, with nothing to show for it.
        console.error(`[rsql] Failed to load schema index for ${schema}`, error);
        // A failed snapshot must not wedge the editor; the next trigger retries,
        // but nothing waits on it again.
        set((s) => ({
          loading: { ...s.loading, [k]: false },
          failed: { ...s.failed, [k]: true },
        }));
      })
      .finally(() => {
        inFlight.delete(k);
      });

    inFlight.set(k, load);
    return load;
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

  isWorthWaitingFor: (projectId, schema) => {
    const k = key(projectId, schema);
    const { failed } = get();
    return failed[k] !== true && get().isPending(projectId, schema);
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
