import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ProjectConnectionStatus } from "@/types";
import type {
  DriverType, ColumnDetail, IndexDetail, ConstraintDetail,
  TriggerDetail, RuleDetail, PolicyDetail, FunctionInfo, TriggerFunctionInfo,
} from "@/types";

// Wire types from Rust (tuples)
type WireTableInfo = [string, string];
type WireQueryResult = [string[], string[][], number];
type WirePackedResult = [string, number]; // [packed_string, elapsed_ms]

const CELL_SEP = "\x1F"; // Unit Separator
const ROW_SEP = "\x1E"; // Record Separator

/** Parse packed result format into columns, rows, and time */
function unpackResult(packed: string, time: number): WireQueryResult {
  if (!packed) return [[], [], time];
  const parts = packed.split(ROW_SEP);
  const columns = parts[0].split(CELL_SEP);
  const rows = parts.slice(1).map((r) => r.split(CELL_SEP));
  return [columns, rows, time];
}
type WireColumnDetail = [string, string, boolean, string | null];
type WireIndexDetail = [string, string, boolean, boolean];
type WireConstraintDetail = [string, string, string];
type WireTriggerDetail = [string, string, string];
type WireRuleDetail = [string, string];
type WirePolicyDetail = [string, string, string];
type WireFunctionInfo = [string, string, string];
type WireTriggerFunctionInfo = [string, string];
type WireForeignKeyInfo = [string, string, string, string];

export interface ForeignKey {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

/** Events received during streamed query execution */
type QueryStreamEvent =
  | { type: "columns"; columns: string; total_rows: number }
  | { type: "chunk"; data: string }
  | { type: "done"; elapsed: number; capped: boolean };

export interface StreamCallbacks {
  onColumns: (columns: string[], totalRows: number) => void;
  onChunk: (rows: string[][]) => void;
  onDone: (elapsed: number, capped: boolean) => void;
}

export interface DatabaseDriver {
  connect(projectId: string, key: [string, string, string, string, string, string]): Promise<ProjectConnectionStatus>;
  cancelQuery?(projectId: string): Promise<boolean>;
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
  runQueryStreamed?(projectId: string, sql: string, streamId: string, callbacks: StreamCallbacks): Promise<void>;
  executeVirtual?(projectId: string, sql: string, queryId: string, pageSize: number): Promise<[string, number, string, number]>;
  fetchPage?(projectId: string, queryId: string, colCount: number, offset: number, limit: number): Promise<string>;
  closeVirtual?(projectId: string, queryId: string): Promise<void>;
  loadActivity(projectId: string): Promise<string[][]>;
  loadDatabaseStats(projectId: string): Promise<[string, string][]>;
  loadTableStats(projectId: string): Promise<string[][]>;
  loadForeignKeys(projectId: string, schema: string): Promise<ForeignKey[]>;
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
  async cancelQuery(projectId: string) {
    return invoke<boolean>("pgsql_cancel_query", { project_id: projectId });
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
    // Use packed format for faster IPC (avoids JSON overhead of nested arrays)
    const [packed, time] = await invoke<WirePackedResult>("pgsql_run_query_packed", { project_id: projectId, sql });
    return unpackResult(packed, time);
  }
  async runQueryStreamed(
    projectId: string,
    sql: string,
    streamId: string,
    { onColumns, onChunk, onDone }: StreamCallbacks,
  ): Promise<void> {
    let resolveStream: () => void;
    let rejectStream: (err: unknown) => void;
    const streamDone = new Promise<void>((resolve, reject) => {
      resolveStream = resolve;
      rejectStream = reject;
    });

    const unlisten = await listen<QueryStreamEvent>(
      `query-stream-${streamId}`,
      (event) => {
        const p = event.payload;
        switch (p.type) {
          case "columns": {
            const cols = p.columns ? p.columns.split(CELL_SEP) : [];
            onColumns(cols, p.total_rows);
            break;
          }
          case "chunk": {
            if (p.data) {
              const rows = p.data.split(ROW_SEP).map((r) => r.split(CELL_SEP));
              onChunk(rows);
            }
            break;
          }
          case "done": {
            onDone(p.elapsed, p.capped);
            unlisten();
            resolveStream!();
            break;
          }
        }
      },
    );

    invoke("pgsql_run_query_streamed", {
      project_id: projectId,
      sql,
      stream_id: streamId,
    }).catch((err) => {
      unlisten();
      rejectStream!(err);
    });

    return streamDone;
  }
  async executeVirtual(projectId: string, sql: string, queryId: string, pageSize: number) {
    return invoke<[string, number, string, number]>("pgsql_execute_virtual", {
      project_id: projectId, sql, query_id: queryId, page_size: pageSize,
    });
  }
  async fetchPage(_projectId: string, queryId: string, colCount: number, offset: number, limit: number) {
    return invoke<string>("pgsql_fetch_page", {
      query_id: queryId, col_count: colCount, offset, limit,
    });
  }
  async closeVirtual(_projectId: string, queryId: string) {
    return invoke<void>("pgsql_close_virtual", {
      query_id: queryId,
    });
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
  async loadForeignKeys(projectId: string, schema: string) {
    const wire = await invoke<WireForeignKeyInfo[]>("pgsql_load_foreign_keys", { project_id: projectId, schema });
    return wire.map(([sourceTable, sourceColumn, targetTable, targetColumn]) => ({
      sourceTable, sourceColumn, targetTable, targetColumn,
    }));
  }
}

export class DriverFactory {
  private static drivers: Map<DriverType, DatabaseDriver> = new Map([
    ["PGSQL", new PostgreSQLDriver()],
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
};

export type { DriverType };
