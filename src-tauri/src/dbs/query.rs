use std::collections::BTreeMap;

use tauri::{AppHandle, Manager, Result, State};

use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_select(app_state: State<'_, AppState>) -> Result<BTreeMap<String, String>> {
  let query_db = app_state.query_db.lock().await;
  let mut queries = BTreeMap::new();
  if let Some(ref query_db) = *query_db {
    for query in query_db.iter() {
      let (key, value) = query.unwrap();
      let key = String::from_utf8(key.to_vec()).unwrap();
      let value = String::from_utf8(value.to_vec()).unwrap();
      queries.insert(key, value);
    }
  };
  Ok(queries)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_insert(query_id: &str, sql: &str, app: AppHandle) -> Result<()> {
  let app_state = app.state::<AppState>();
  let db = app_state.query_db.lock().await;
  if let Some(ref db_instance) = *db {
    db_instance.insert(query_id, sql).unwrap();
  }
  Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_delete(query_id: &str, app_state: State<'_, AppState>) -> Result<()> {
  let query_db = app_state.query_db.lock().await;
  if let Some(ref query_db) = *query_db {
    query_db.remove(query_id).unwrap();
  };
  Ok(())
}
