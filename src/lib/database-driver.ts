import { invoke } from "@tauri-apps/api/core";
import { ProjectConnectionStatus } from "@/types";
import type {
  DriverType, ColumnDetail, IndexDetail, ConstraintDetail,
  TriggerDetail, RuleDetail, PolicyDetail, FunctionInfo, TriggerFunctionInfo,
} from "@/types";

// Wire types from Rust (tuples)
type WireTableInfo = [string, string];
type WireQueryResult = [string[], string[][], number];
type WireColumnDetail = [string, string, boolean, string | null];
type WireIndexDetail = [string, string, boolean, boolean];
type WireConstraintDetail = [string, string, string];
type WireTriggerDetail = [string, string, string];
type WireRuleDetail = [string, string];
type WirePolicyDetail = [string, string, string];
type WireFunctionInfo = [string, string, string];
type WireTriggerFunctionInfo = [string, string];

export interface DatabaseDriver {
  connect(projectId: string, key: [string, string, string, string, string, string]): Promise<ProjectConnectionStatus>;
  loadSchemas(projectId: string): Promise<string[]>;
  loadTables(projectId: string, schema: string): Promise<WireTableInfo[]>;
  loadColumns(projectId: string, schema: string, table: string): Promise<string[]>;
  loadColumnDetails(projectId: string, schema: string, table: string): Promise<ColumnDetail[]>;
  loadIndexes(projectId: string, schema: string, table: string): Promise<IndexDetail[]>;
  loadConstraints(projectId: string, schema: string, table: string): Promise<ConstraintDetail[]>;
  loadTriggers(projectId: string, schema: string, table: string): Promise<TriggerDetail[]>;
  loadRules(projectId: string, schema: string, table: string): Promise<RuleDetail[]>;
  loadPolicies(projectId: string, schema: string, table: string): Promise<PolicyDetail[]>;
  loadViews(projectId: string, schema: string): Promise<string[]>;
  loadMaterializedViews(projectId: string, schema: string): Promise<string[]>;
  loadFunctions(projectId: string, schema: string): Promise<FunctionInfo[]>;
  loadTriggerFunctions(projectId: string, schema: string): Promise<TriggerFunctionInfo[]>;
  runQuery(projectId: string, sql: string): Promise<WireQueryResult>;
  loadActivity(projectId: string): Promise<string[][]>;
  loadDatabaseStats(projectId: string): Promise<[string, string][]>;
  loadTableStats(projectId: string): Promise<string[][]>;
}

function parseColumnDetails(wire: WireColumnDetail[]): ColumnDetail[] {
  return wire.map(([name, dataType, nullable, defaultValue]) => ({
    name, dataType, nullable, defaultValue,
  }));
}

function parseIndexDetails(wire: WireIndexDetail[]): IndexDetail[] {
  return wire.map(([indexName, columnName, isUnique, isPrimary]) => ({
    indexName, columnName, isUnique, isPrimary,
  }));
}

function parseConstraintDetails(wire: WireConstraintDetail[]): ConstraintDetail[] {
  return wire.map(([constraintName, constraintType, columnName]) => ({
    constraintName, constraintType, columnName,
  }));
}

function parseTriggerDetails(wire: WireTriggerDetail[]): TriggerDetail[] {
  return wire.map(([triggerName, event, timing]) => ({
    triggerName, event, timing,
  }));
}

function parseRuleDetails(wire: WireRuleDetail[]): RuleDetail[] {
  return wire.map(([ruleName, event]) => ({ ruleName, event }));
}

function parsePolicyDetails(wire: WirePolicyDetail[]): PolicyDetail[] {
  return wire.map(([policyName, permissive, command]) => ({
    policyName, permissive, command,
  }));
}

function parseFunctionInfo(wire: WireFunctionInfo[]): FunctionInfo[] {
  return wire.map(([name, returnType, arguments_]) => ({
    name, returnType, arguments: arguments_,
  }));
}

function parseTriggerFunctionInfo(wire: WireTriggerFunctionInfo[]): TriggerFunctionInfo[] {
  return wire.map(([name, arguments_]) => ({
    name, arguments: arguments_,
  }));
}

class PostgreSQLDriver implements DatabaseDriver {
  async connect(projectId: string, key: [string, string, string, string, string, string]) {
    return invoke<ProjectConnectionStatus>("pgsql_connector", { project_id: projectId, key });
  }
  async loadSchemas(projectId: string) {
    return invoke<string[]>("pgsql_load_schemas", { project_id: projectId });
  }
  async loadTables(projectId: string, schema: string) {
    return invoke<WireTableInfo[]>("pgsql_load_tables", { project_id: projectId, schema });
  }
  async loadColumns(projectId: string, schema: string, table: string) {
    return invoke<string[]>("pgsql_load_columns", { project_id: projectId, schema, table });
  }
  async loadColumnDetails(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireColumnDetail[]>("pgsql_load_column_details", { project_id: projectId, schema, table });
    return parseColumnDetails(wire);
  }
  async loadIndexes(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireIndexDetail[]>("pgsql_load_indexes", { project_id: projectId, schema, table });
    return parseIndexDetails(wire);
  }
  async loadConstraints(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireConstraintDetail[]>("pgsql_load_constraints", { project_id: projectId, schema, table });
    return parseConstraintDetails(wire);
  }
  async loadTriggers(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireTriggerDetail[]>("pgsql_load_triggers", { project_id: projectId, schema, table });
    return parseTriggerDetails(wire);
  }
  async loadRules(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireRuleDetail[]>("pgsql_load_rules", { project_id: projectId, schema, table });
    return parseRuleDetails(wire);
  }
  async loadPolicies(projectId: string, schema: string, table: string) {
    const wire = await invoke<WirePolicyDetail[]>("pgsql_load_policies", { project_id: projectId, schema, table });
    return parsePolicyDetails(wire);
  }
  async loadViews(projectId: string, schema: string) {
    return invoke<string[]>("pgsql_load_views", { project_id: projectId, schema });
  }
  async loadMaterializedViews(projectId: string, schema: string) {
    return invoke<string[]>("pgsql_load_materialized_views", { project_id: projectId, schema });
  }
  async loadFunctions(projectId: string, schema: string) {
    const wire = await invoke<WireFunctionInfo[]>("pgsql_load_functions", { project_id: projectId, schema });
    return parseFunctionInfo(wire);
  }
  async loadTriggerFunctions(projectId: string, schema: string) {
    const wire = await invoke<WireTriggerFunctionInfo[]>("pgsql_load_trigger_functions", { project_id: projectId, schema });
    return parseTriggerFunctionInfo(wire);
  }
  async runQuery(projectId: string, sql: string) {
    return invoke<WireQueryResult>("pgsql_run_query", { project_id: projectId, sql });
  }
  async loadActivity(projectId: string) {
    return invoke<string[][]>("pgsql_load_activity", { project_id: projectId });
  }
  async loadDatabaseStats(projectId: string) {
    return invoke<[string, string][]>("pgsql_load_database_stats", { project_id: projectId });
  }
  async loadTableStats(projectId: string) {
    return invoke<string[][]>("pgsql_load_table_stats", { project_id: projectId });
  }
}

class RedshiftDriver implements DatabaseDriver {
  async connect(projectId: string, key: [string, string, string, string, string, string]) {
    return invoke<ProjectConnectionStatus>("redshift_connector", { project_id: projectId, key });
  }
  async loadSchemas(projectId: string) {
    return invoke<string[]>("redshift_load_schemas", { project_id: projectId });
  }
  async loadTables(projectId: string, schema: string) {
    return invoke<WireTableInfo[]>("redshift_load_tables", { project_id: projectId, schema });
  }
  async loadColumns(projectId: string, schema: string, table: string) {
    return invoke<string[]>("redshift_load_columns", { project_id: projectId, schema, table });
  }
  async loadColumnDetails(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireColumnDetail[]>("redshift_load_column_details", { project_id: projectId, schema, table });
    return parseColumnDetails(wire);
  }
  async loadIndexes(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireIndexDetail[]>("redshift_load_indexes", { project_id: projectId, schema, table });
    return parseIndexDetails(wire);
  }
  async loadConstraints(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireConstraintDetail[]>("redshift_load_constraints", { project_id: projectId, schema, table });
    return parseConstraintDetails(wire);
  }
  async loadTriggers(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireTriggerDetail[]>("redshift_load_triggers", { project_id: projectId, schema, table });
    return parseTriggerDetails(wire);
  }
  async loadRules(projectId: string, schema: string, table: string) {
    const wire = await invoke<WireRuleDetail[]>("redshift_load_rules", { project_id: projectId, schema, table });
    return parseRuleDetails(wire);
  }
  async loadPolicies(projectId: string, schema: string, table: string) {
    const wire = await invoke<WirePolicyDetail[]>("redshift_load_policies", { project_id: projectId, schema, table });
    return parsePolicyDetails(wire);
  }
  async loadViews(projectId: string, schema: string) {
    return invoke<string[]>("redshift_load_views", { project_id: projectId, schema });
  }
  async loadMaterializedViews(projectId: string, schema: string) {
    return invoke<string[]>("redshift_load_materialized_views", { project_id: projectId, schema });
  }
  async loadFunctions(projectId: string, schema: string) {
    const wire = await invoke<WireFunctionInfo[]>("redshift_load_functions", { project_id: projectId, schema });
    return parseFunctionInfo(wire);
  }
  async loadTriggerFunctions(projectId: string, schema: string) {
    const wire = await invoke<WireTriggerFunctionInfo[]>("redshift_load_trigger_functions", { project_id: projectId, schema });
    return parseTriggerFunctionInfo(wire);
  }
  async runQuery(projectId: string, sql: string) {
    return invoke<WireQueryResult>("redshift_run_query", { project_id: projectId, sql });
  }
  async loadActivity(projectId: string) {
    return invoke<string[][]>("redshift_load_activity", { project_id: projectId });
  }
  async loadDatabaseStats(projectId: string) {
    return invoke<[string, string][]>("redshift_load_database_stats", { project_id: projectId });
  }
  async loadTableStats(projectId: string) {
    return invoke<string[][]>("redshift_load_table_stats", { project_id: projectId });
  }
}

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

export interface DriverConfig {
  name: string;
  defaultPort: string;
}

export const DRIVER_CONFIGS: Record<DriverType, DriverConfig> = {
  PGSQL: { name: "PostgreSQL", defaultPort: "5432" },
  REDSHIFT: { name: "Amazon Redshift", defaultPort: "5439" },
};

export type { DriverType };
