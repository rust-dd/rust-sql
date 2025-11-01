import { invoke } from "@tauri-apps/api/core";
import type { ProjectConnectionStatus, TableInfo, QueryResult } from "@/tauri";

export type DriverType = "PGSQL" | "REDSHIFT";

export interface DatabaseDriver {
  connect(projectId: string, key: [string, string, string, string, string, string]): Promise<ProjectConnectionStatus>;
  loadSchemas(projectId: string): Promise<string[]>;
  loadTables(projectId: string, schema: string): Promise<TableInfo[]>;
  loadColumns(projectId: string, schema: string, table: string): Promise<string[]>;
  runQuery(projectId: string, sql: string): Promise<QueryResult>;
}

class PostgreSQLDriver implements DatabaseDriver {
  async connect(projectId: string, key: [string, string, string, string, string, string]): Promise<ProjectConnectionStatus> {
    return await invoke<ProjectConnectionStatus>("pgsql_connector", { project_id: projectId, key });
  }

  async loadSchemas(projectId: string): Promise<string[]> {
    return await invoke<string[]>("pgsql_load_schemas", { project_id: projectId });
  }

  async loadTables(projectId: string, schema: string): Promise<TableInfo[]> {
    return await invoke<TableInfo[]>("pgsql_load_tables", { project_id: projectId, schema });
  }

  async loadColumns(projectId: string, schema: string, table: string): Promise<string[]> {
    return await invoke<string[]>("pgsql_load_columns", { project_id: projectId, schema, table });
  }

  async runQuery(projectId: string, sql: string): Promise<QueryResult> {
    return await invoke<QueryResult>("pgsql_run_query", { project_id: projectId, sql });
  }
}

class RedshiftDriver implements DatabaseDriver {
  async connect(projectId: string, key: [string, string, string, string, string, string]): Promise<ProjectConnectionStatus> {
    return await invoke<ProjectConnectionStatus>("redshift_connector", { project_id: projectId, key });
  }

  async loadSchemas(projectId: string): Promise<string[]> {
    return await invoke<string[]>("redshift_load_schemas", { project_id: projectId });
  }

  async loadTables(projectId: string, schema: string): Promise<TableInfo[]> {
    return await invoke<TableInfo[]>("redshift_load_tables", { project_id: projectId, schema });
  }

  async loadColumns(projectId: string, schema: string, table: string): Promise<string[]> {
    return await invoke<string[]>("redshift_load_columns", { project_id: projectId, schema, table });
  }

  async runQuery(projectId: string, sql: string): Promise<QueryResult> {
    return await invoke<QueryResult>("redshift_run_query", { project_id: projectId, sql });
  }
}

// Factory pattern para criar drivers
export class DriverFactory {
  private static drivers: Map<DriverType, DatabaseDriver> = new Map([
    ["PGSQL", new PostgreSQLDriver()],
    ["REDSHIFT", new RedshiftDriver()],
  ]);

  static getDriver(driverType: DriverType): DatabaseDriver {
    const driver = this.drivers.get(driverType);
    if (!driver) {
      throw new Error(`Driver ${driverType} not found`);
    }
    return driver;
  }

  static getSupportedDrivers(): DriverType[] {
    return Array.from(this.drivers.keys());
  }
}

// Configuração de cada driver
export interface DriverConfig {
  name: string;
  defaultPort: string;
  icon?: string;
}

export const DRIVER_CONFIGS: Record<DriverType, DriverConfig> = {
  PGSQL: {
    name: "PostgreSQL",
    defaultPort: "5432",
  },
  REDSHIFT: {
    name: "Amazon Redshift",
    defaultPort: "5439",
  },
};

