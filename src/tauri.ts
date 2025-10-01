import { invoke } from "@tauri-apps/api/core";

export type ProjectMap = Record<string, string[]>;
export type QueryMap = Record<string, string>;

export enum ProjectConnectionStatus {
  Connected = "Connected",
  Connecting = "Connecting",
  Disconnected = "Disconnected",
  Failed = "Failed",
}

export async function getProjects(): Promise<ProjectMap> {
  return await invoke<ProjectMap>("project_db_select");
}

export async function insertProject(
  project_id: string,
  project_details: string[],
): Promise<void> {
  await invoke("project_db_insert", { project_id, project_details });
}

export async function deleteProject(project_id: string): Promise<void> {
  await invoke("project_db_delete", { project_id });
}

export async function getQueries(): Promise<QueryMap> {
  return await invoke<QueryMap>("query_db_select");
}

export async function insertQuery(
  query_id: string,
  sql: string,
): Promise<void> {
  await invoke("query_db_insert", { query_id, sql });
}

export async function deleteQuery(query_id: string): Promise<void> {
  await invoke("query_db_delete", { query_id });
}

export async function pgsqlConnector(
  project_id: string,
  key: [string, string, string, string, string],
): Promise<ProjectConnectionStatus> {
  return await invoke<ProjectConnectionStatus>("pgsql_connector", {
    project_id,
    key,
  });
}

export async function pgsqlLoadSchemas(project_id: string): Promise<string[]> {
  return await invoke<string[]>("pgsql_load_schemas", { project_id });
}

export type TableInfo = [string, string]; // [table_name, size]
export async function pgsqlLoadTables(
  project_id: string,
  schema: string,
): Promise<TableInfo[]> {
  return await invoke<TableInfo[]>("pgsql_load_tables", { project_id, schema });
}

export type QueryResult = [string[], string[][], number];
export async function pgsqlRunQuery(
  project_id: string,
  sql: string,
): Promise<QueryResult> {
  return await invoke<QueryResult>("pgsql_run_query", { project_id, sql });
}

export async function pgsqlLoadColumns(
  project_id: string,
  schema: string,
  table: string,
): Promise<string[]> {
  return await invoke<string[]>("pgsql_load_columns", {
    project_id,
    schema,
    table,
  });
}
