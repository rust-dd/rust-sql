import type { StateCreator } from "zustand";
import { DriverFactory } from "@/lib/database-driver";
import type { ColumnDetail, TableInfo } from "@/types";
import type { ProjectState } from "./index";

export type SchemaSlice = {
  schemas: Record<string, string[]>;
  tables: Record<string, TableInfo[]>;
  columns: Record<string, string[]>;
  columnDetails: Record<string, ColumnDetail[]>;
  loadSchemas: (projectId: string) => Promise<void>;
  loadTables: (projectId: string, schema: string) => Promise<void>;
  loadColumns: (projectId: string, schema: string, table: string) => Promise<string[]>;
  loadColumnDetails: (projectId: string, schema: string, table: string) => Promise<ColumnDetail[]>;
  loadSchemaObjects: (projectId: string, schema: string) => Promise<void>;
};

export const createSchemaSlice: StateCreator<
  ProjectState,
  [["zustand/immer", never]],
  [],
  SchemaSlice
> = (set, get) => ({
  schemas: {},
  tables: {},
  columns: {},
  columnDetails: {},

  loadSchemas: async (projectId: string) => {
    const { projects } = get();
    const d = projects[projectId];
    if (!d) return;
    const driver = DriverFactory.getDriver(d.driver);
    const sc = await driver.loadSchemas(projectId);
    set((s) => {
      s.schemas[projectId] = sc;
    });
  },

  loadTables: async (projectId: string, schema: string) => {
    const key = `${projectId}::${schema}`;
    const { tables, projects } = get();
    if (tables[key]) return;

    const d = projects[projectId];
    if (!d) return;
    const driver = DriverFactory.getDriver(d.driver);
    const rawRows = await driver.loadTables(projectId, schema);
    const rows: TableInfo[] = rawRows.map(([name, size]) => ({ name, size }));
    set((s) => {
      s.tables[key] = rows;
    });
  },

  loadColumns: async (projectId: string, schema: string, table: string) => {
    const colKey = `${projectId}::${schema}::${table}`;
    const { columns, projects } = get();
    if (columns[colKey]) return columns[colKey];

    const d = projects[projectId];
    if (!d) return [];
    const driver = DriverFactory.getDriver(d.driver);
    const cols = await driver.loadColumns(projectId, schema, table);
    set((s) => {
      s.columns[colKey] = cols;
    });
    return cols;
  },

  loadColumnDetails: async (projectId: string, schema: string, table: string) => {
    const key = `${projectId}::${schema}::${table}`;
    const { columnDetails, projects } = get();
    if (columnDetails[key]) return columnDetails[key];

    const d = projects[projectId];
    if (!d) return [];
    const driver = DriverFactory.getDriver(d.driver);
    const details = await driver.loadColumnDetails(projectId, schema, table);
    set((s) => {
      s.columnDetails[key] = details;
    });
    return details;
  },

  loadSchemaObjects: async (projectId: string, schema: string) => {
    const key = `${projectId}::${schema}`;
    const { views: existingViews, projects } = get();
    if (existingViews[key]) return;

    const d = projects[projectId];
    if (!d) return;
    const driver = DriverFactory.getDriver(d.driver);
    const [vR, mvR, fnR, tfnR] = await Promise.allSettled([
      driver.loadViews(projectId, schema),
      driver.loadMaterializedViews(projectId, schema),
      driver.loadFunctions(projectId, schema),
      driver.loadTriggerFunctions(projectId, schema),
    ]);

    const val = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    set((s) => {
      s.views[key] = val(vR, []);
      s.materializedViews[key] = val(mvR, []);
      s.functions[key] = val(fnR, []);
      s.triggerFunctions[key] = val(tfnR, []);
    });
  },
});
