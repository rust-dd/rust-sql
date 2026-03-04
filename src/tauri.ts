import { invoke } from "@tauri-apps/api/core";

// Raw wire types from Rust backend (string arrays)
export type RawProjectMap = Record<string, string[]>;

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
