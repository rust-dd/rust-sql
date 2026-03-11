import { invoke } from "@tauri-apps/api/core";

// Raw wire types from Rust backend (string arrays)
export type RawProjectMap = Record<string, string[]>;

export interface SystemResourceUsage {
  app_cpu_percent: number;
  app_memory_rss_mb: number;
  app_process_count: number;
  network_rx_mbps: number;
  network_tx_mbps: number;
  db_connections_in_use: number;
  db_connections_open: number;
  db_connections_max: number;
  db_connections_waiting: number;
}

export async function getProjects(): Promise<RawProjectMap> {
  return await invoke<RawProjectMap>("project_db_select");
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

export async function getQueries(): Promise<Record<string, string>> {
  return await invoke<Record<string, string>>("query_db_select");
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

export async function getSystemResourceUsage(): Promise<SystemResourceUsage> {
  return await invoke<SystemResourceUsage>("system_resource_usage");
}

export async function workspaceSave(name: string, tabs: string): Promise<void> {
  await invoke("workspace_save", { name, tabs });
}

export async function workspaceLoadAll(): Promise<[string, string][]> {
  return await invoke<[string, string][]>("workspace_load_all");
}

export async function workspaceDelete(name: string): Promise<void> {
  await invoke("workspace_delete", { name });
}

export async function settingsGetAll(): Promise<Record<string, string>> {
  return await invoke<Record<string, string>>("settings_get_all");
}

export async function settingsGet(key: string): Promise<string | null> {
  return await invoke<string | null>("settings_get", { key });
}

export async function settingsSet(key: string, value: string): Promise<void> {
  await invoke("settings_set", { key, value });
}

export async function settingsDelete(key: string): Promise<void> {
  await invoke("settings_delete", { key });
}

export interface AIModelInfo {
  id: string;
  label: string;
}

export async function aiFetchClaudeModels(api_key: string): Promise<AIModelInfo[]> {
  return await invoke<AIModelInfo[]>("ai_fetch_claude_models", { api_key });
}

export async function aiFetchOpenaiModels(api_key: string): Promise<AIModelInfo[]> {
  return await invoke<AIModelInfo[]>("ai_fetch_openai_models", { api_key });
}

export async function pgsqlTestConnection(key: [string, string, string, string, string, string]): Promise<string> {
  return await invoke<string>("pgsql_test_connection", { key });
}
