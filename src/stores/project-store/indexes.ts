import type { StateCreator } from "zustand";
import { DriverFactory } from "@/lib/database-driver";
import type {
  IndexDetail,
  ConstraintDetail,
  TriggerDetail,
  RuleDetail,
  PolicyDetail,
} from "@/types";
import type { ProjectState } from "./index";

export type IndexesSlice = {
  indexes: Record<string, IndexDetail[]>;
  constraints: Record<string, ConstraintDetail[]>;
  triggers: Record<string, TriggerDetail[]>;
  rules: Record<string, RuleDetail[]>;
  policies: Record<string, PolicyDetail[]>;
  loadIndexes: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<IndexDetail[]>;
  loadConstraints: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<ConstraintDetail[]>;
};

export const createIndexesSlice: StateCreator<
  ProjectState,
  [["zustand/immer", never]],
  [],
  IndexesSlice
> = (set, get) => ({
  indexes: {},
  constraints: {},
  triggers: {},
  rules: {},
  policies: {},

  loadIndexes: async (projectId: string, schema: string, table: string) => {
    const key = `${projectId}::${schema}::${table}`;
    const { indexes, projects } = get();
    if (indexes[key]) return indexes[key];

    const d = projects[projectId];
    if (!d) return [];
    const driver = DriverFactory.getDriver(d.driver);
    const idx = await driver.loadIndexes(projectId, schema, table);
    set((s) => {
      s.indexes[key] = idx;
    });
    return idx;
  },

  loadConstraints: async (
    projectId: string,
    schema: string,
    table: string,
  ) => {
    const key = `${projectId}::${schema}::${table}`;
    const { constraints, projects } = get();
    if (constraints[key]) return constraints[key];

    const d = projects[projectId];
    if (!d) return [];
    const driver = DriverFactory.getDriver(d.driver);
    const c = await driver.loadConstraints(projectId, schema, table);
    set((s) => {
      s.constraints[key] = c;
    });
    return c;
  },
});
