import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import { DriverFactory } from "@/lib/database-driver";
import type {
  ProjectMap,
  ProjectDetails,
  TableInfo,
  ColumnDetail,
  IndexDetail,
  ConstraintDetail,
  TriggerDetail,
  RuleDetail,
  PolicyDetail,
  FunctionInfo,
  TriggerFunctionInfo,
  ProjectConnectionStatus,
  DriverType,
} from "@/types";
import { ProjectConnectionStatus as PCS } from "@/types";
import {
  getProjects,
  insertProject,
  deleteProject as deleteProjectApi,
} from "@/tauri";

interface ProjectState {
  projects: ProjectMap;
  status: Record<string, ProjectConnectionStatus>;
  connectionErrors: Record<string, string>;
  schemas: Record<string, string[]>;
  tables: Record<string, TableInfo[]>;
  columns: Record<string, string[]>;
  columnDetails: Record<string, ColumnDetail[]>;
  indexes: Record<string, IndexDetail[]>;
  constraints: Record<string, ConstraintDetail[]>;
  triggers: Record<string, TriggerDetail[]>;
  rules: Record<string, RuleDetail[]>;
  policies: Record<string, PolicyDetail[]>;
  serverDatabases: Record<string, string[]>;
  serverTablespaces: Record<string, [string, string, string][]>;
  views: Record<string, string[]>;
  materializedViews: Record<string, string[]>;
  functions: Record<string, FunctionInfo[]>;
  triggerFunctions: Record<string, TriggerFunctionInfo[]>;

  loadProjects: () => Promise<void>;
  connect: (projectId: string) => Promise<void>;
  loadSchemas: (projectId: string) => Promise<void>;
  loadTables: (projectId: string, schema: string) => Promise<void>;
  loadColumns: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<string[]>;
  loadColumnDetails: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<ColumnDetail[]>;
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
  loadTableMetadata: (
    projectId: string,
    schema: string,
    table: string,
  ) => Promise<void>;
  loadSchemaObjects: (projectId: string, schema: string) => Promise<void>;
  refreshConnection: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  saveConnection: (name: string, details: ProjectDetails) => Promise<void>;
  updateConnection: (name: string, details: ProjectDetails) => Promise<void>;
  addDatabaseToServer: (
    sourceProjectId: string,
    name: string,
    database: string,
  ) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    projects: {},
    status: {},
    connectionErrors: {},
    schemas: {},
    tables: {},
    columns: {},
    columnDetails: {},
    indexes: {},
    constraints: {},
    triggers: {},
    rules: {},
    policies: {},
    serverDatabases: {},
    serverTablespaces: {},
    views: {},
    materializedViews: {},
    functions: {},
    triggerFunctions: {},

    loadProjects: async () => {
      try {
        const raw = await getProjects();
        const projects: ProjectMap = {};
        for (const [id, arr] of Object.entries(raw)) {
          projects[id] = parseProjectDetails(arr);
        }
        set({ projects });
      } catch (err) {
        console.error("Failed to load projects, retrying in 500ms...", err);
        // Retry once after a short delay — handles race where
        // the Tauri backend hasn't finished setup yet.
        await new Promise((r) => setTimeout(r, 500));
        try {
          const raw = await getProjects();
          const projects: ProjectMap = {};
          for (const [id, arr] of Object.entries(raw)) {
            projects[id] = parseProjectDetails(arr);
          }
          set({ projects });
        } catch (retryErr) {
          console.error("Failed to load projects after retry:", retryErr);
        }
      }
    },

    connect: async (projectId: string) => {
      const { projects } = get();
      const d = projects[projectId];
      if (!d) return;

      set((s) => {
        s.status[projectId] = PCS.Connecting;
        s.connectionErrors[projectId] = "";
      });

      try {
        const driver = DriverFactory.getDriver(d.driver);
        const key: [string, string, string, string, string, string] = [
          d.username,
          d.password,
          d.database,
          d.host,
          d.port,
          d.ssl,
        ];
        const ssh =
          d.sshEnabled === "true"
            ? [
                d.sshHost,
                d.sshPort || "22",
                d.sshUser,
                d.sshPassword,
                d.sshKeyPath,
              ]
            : undefined;
        const st = await driver.connect(projectId, key, ssh);
        set((s) => {
          s.status[projectId] = st;
        });

        if (st === PCS.Connected) {
          const [sc, dbs, tsp] = await Promise.allSettled([
            driver.loadSchemas(projectId),
            driver.loadDatabases?.(projectId),
            driver.loadTablespaces?.(projectId),
          ]);
          set((s) => {
            s.schemas[projectId] = sc.status === "fulfilled" ? sc.value : [];
            s.serverDatabases[projectId] =
              dbs.status === "fulfilled" && dbs.value ? dbs.value : [];
            s.serverTablespaces[projectId] =
              tsp.status === "fulfilled" && tsp.value ? tsp.value : [];
          });
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Connection failed";
        set((s) => {
          s.status[projectId] = PCS.Failed;
          s.connectionErrors[projectId] = msg;
        });
        const d = projects[projectId];
        toast.error(`Connection failed: ${d?.database || projectId}`, {
          description: msg,
          duration: 10000,
        });
      }
    },

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

    loadColumnDetails: async (
      projectId: string,
      schema: string,
      table: string,
    ) => {
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

    refreshConnection: async (projectId: string) => {
      const { projects, status, tables } = get();
      const d = projects[projectId];
      if (!d || status[projectId] !== PCS.Connected) return;

      // Remember which schemas had tables loaded so we can reload them
      const schemaPrefix = `${projectId}::`;
      const expandedSchemas = Object.keys(tables)
        .filter((k) => k.startsWith(schemaPrefix))
        .map((k) => k.slice(schemaPrefix.length));

      // Clear all cached metadata for this project
      set((s) => {
        // Clear schema-level caches
        for (const key of Object.keys(s.tables)) {
          if (key.startsWith(schemaPrefix)) delete s.tables[key];
        }
        for (const key of Object.keys(s.columns)) {
          if (key.startsWith(schemaPrefix)) delete s.columns[key];
        }
        for (const key of Object.keys(s.columnDetails)) {
          if (key.startsWith(schemaPrefix)) delete s.columnDetails[key];
        }
        for (const key of Object.keys(s.indexes)) {
          if (key.startsWith(schemaPrefix)) delete s.indexes[key];
        }
        for (const key of Object.keys(s.constraints)) {
          if (key.startsWith(schemaPrefix)) delete s.constraints[key];
        }
        for (const key of Object.keys(s.triggers)) {
          if (key.startsWith(schemaPrefix)) delete s.triggers[key];
        }
        for (const key of Object.keys(s.rules)) {
          if (key.startsWith(schemaPrefix)) delete s.rules[key];
        }
        for (const key of Object.keys(s.policies)) {
          if (key.startsWith(schemaPrefix)) delete s.policies[key];
        }
        for (const key of Object.keys(s.views)) {
          if (key.startsWith(schemaPrefix)) delete s.views[key];
        }
        for (const key of Object.keys(s.materializedViews)) {
          if (key.startsWith(schemaPrefix)) delete s.materializedViews[key];
        }
        for (const key of Object.keys(s.functions)) {
          if (key.startsWith(schemaPrefix)) delete s.functions[key];
        }
        for (const key of Object.keys(s.triggerFunctions)) {
          if (key.startsWith(schemaPrefix)) delete s.triggerFunctions[key];
        }

        // Clear project-level caches
        delete s.schemas[projectId];
        delete s.serverDatabases[projectId];
        delete s.serverTablespaces[projectId];
      });

      // Reload schemas, databases, tablespaces
      try {
        const driver = DriverFactory.getDriver(d.driver);
        const [sc, dbs, tsp] = await Promise.allSettled([
          driver.loadSchemas(projectId),
          driver.loadDatabases?.(projectId),
          driver.loadTablespaces?.(projectId),
        ]);
        set((s) => {
          s.schemas[projectId] = sc.status === "fulfilled" ? sc.value : [];
          s.serverDatabases[projectId] =
            dbs.status === "fulfilled" && dbs.value ? dbs.value : [];
          s.serverTablespaces[projectId] =
            tsp.status === "fulfilled" && tsp.value ? tsp.value : [];
        });

        // Reload tables and schema objects for previously expanded schemas
        await Promise.all(
          expandedSchemas.map((schema) =>
            Promise.all([
              get().loadTables(projectId, schema),
              get().loadSchemaObjects(projectId, schema),
            ]),
          ),
        );

        toast.success("Connection refreshed");
      } catch {
        toast.error("Failed to refresh connection data");
      }
    },

    deleteProject: async (projectId: string) => {
      await deleteProjectApi(projectId);
      await get().loadProjects();
      set((s) => {
        s.status[projectId] = PCS.Disconnected;
      });
    },

    saveConnection: async (name: string, details: ProjectDetails) => {
      const arr = [
        details.driver,
        details.username,
        details.password,
        details.database,
        details.host,
        details.port,
        details.ssl,
        details.sshEnabled ?? "false",
        details.sshHost ?? "",
        details.sshPort ?? "22",
        details.sshUser ?? "",
        details.sshPassword ?? "",
        details.sshKeyPath ?? "",
      ];
      await insertProject(name, arr);
      await get().loadProjects();
    },

    updateConnection: async (name: string, details: ProjectDetails) => {
      const arr = [
        details.driver,
        details.username,
        details.password,
        details.database,
        details.host,
        details.port,
        details.ssl,
        details.sshEnabled ?? "false",
        details.sshHost ?? "",
        details.sshPort ?? "22",
        details.sshUser ?? "",
        details.sshPassword ?? "",
        details.sshKeyPath ?? "",
      ];
      await insertProject(name, arr);
      await get().loadProjects();
    },

    addDatabaseToServer: async (
      sourceProjectId: string,
      name: string,
      database: string,
    ) => {
      const { projects } = get();
      const source = projects[sourceProjectId];
      if (!source) return;
      const details = { ...source, database };
      await get().saveConnection(name, details);
    },
  })),
);

function parseProjectDetails(arr: string[]): ProjectDetails {
  return {
    driver: (arr[0] ?? "PGSQL") as DriverType,
    username: arr[1] ?? "",
    password: arr[2] ?? "",
    database: arr[3] ?? "",
    host: arr[4] ?? "",
    port: arr[5] ?? "",
    ssl: arr[6] ?? "false",
    sshEnabled: arr[7] ?? "false",
    sshHost: arr[8] ?? "",
    sshPort: arr[9] ?? "22",
    sshUser: arr[10] ?? "",
    sshPassword: arr[11] ?? "",
    sshKeyPath: arr[12] ?? "",
  };
}
