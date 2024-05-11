use tauri::{Result, State};

use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_select(
  project_name: &str,
  app_state: State<'_, AppState>,
) -> Result<String> {
  let project_db = app_state.project_db.lock().await;
  let db = project_db.clone().unwrap();
  let project = db.get(project_name).unwrap();
  let project = project.unwrap().to_vec();
  Ok(String::from_utf8(project).unwrap())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_insert(
  project_name: &str,
  project_details: &str,
  app_state: State<'_, AppState>,
) -> Result<()> {
  let project_db = app_state.project_db.lock().await;
  let db = project_db.clone().unwrap();
  db.insert(project_name, project_details).unwrap();
  Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_delete(project_name: &str, app_state: State<'_, AppState>) -> Result<()> {
  let db = app_state.project_db.lock().await;
  let db = db.clone().unwrap();
  db.remove(project_name).unwrap();
  Ok(())
}

