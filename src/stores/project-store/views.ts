import type { StateCreator } from "zustand";
import { DriverFactory } from "@/lib/database-driver";
import type { FunctionInfo, TriggerFunctionInfo } from "@/types";
import type { ProjectState } from "./index";

export type ViewsSlice = {
  views: Record<string, string[]>;
  materializedViews: Record<string, string[]>;
  functions: Record<string, FunctionInfo[]>;
  triggerFunctions: Record<string, TriggerFunctionInfo[]>;
  serverDatabases: Record<string, string[]>;
  serverTablespaces: Record<string, [string, string, string][]>;
  loadTableMetadata: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<void>;
};

export const createViewsSlice: StateCreator<
  ProjectState,
  [["zustand/immer", never]],
  [],
  ViewsSlice
> = (set, get) => ({
  views: {},
  materializedViews: {},
  functions: {},
  triggerFunctions: {},
  serverDatabases: {},
  serverTablespaces: {},

  loadTableMetadata: async (
    projectId: string,
    schema: string,
    table: string,
  ) => {
    const key = `${projectId}::${schema}::${table}`;
    const { columnDetails, projects } = get();
    if (columnDetails[key]) return;

    const d = projects[projectId];
    if (!d) return;
    const driver = DriverFactory.getDriver(d.driver);

    const [colsR, idxsR, consR, trigsR, rlsR, polsR] =
      await Promise.allSettled([
        driver.loadColumnDetails(projectId, schema, table),
        driver.loadIndexes(projectId, schema, table),
        driver.loadConstraints(projectId, schema, table),
        driver.loadTriggers(projectId, schema, table),
        driver.loadRules(projectId, schema, table),
        driver.loadPolicies(projectId, schema, table),
      ]);

    const val = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    set((s) => {
      s.columnDetails[key] = val(colsR, []);
      s.indexes[key] = val(idxsR, []);
      s.constraints[key] = val(consR, []);
      s.triggers[key] = val(trigsR, []);
      s.rules[key] = val(rlsR, []);
      s.policies[key] = val(polsR, []);
    });
  },
});
