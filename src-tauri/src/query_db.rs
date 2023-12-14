use std::collections::BTreeMap;

use serde::Serialize;
use tauri::{AppHandle, Manager, Result, State};

use crate::AppState;

#[derive(Default, Serialize)]
pub struct QueryDetails {
  pub title: String,
  pub sql: String,
}

#[tauri::command]
pub async fn insert_query(key: &str, sql: &str, app: AppHandle) -> Result<()> {
  let app_state = app.state::<AppState>();
  let db = app_state.query_db.lock().await;
  if let Some(ref db_instance) = *db {
    db_instance.insert(key, sql).unwrap();
  }
  Ok(())
}

#[tauri::command]
pub async fn select_queries(app_state: State<'_, AppState>) -> Result<BTreeMap<String, String>> {
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

#[tauri::command]
pub async fn delete_query(key: String, app_state: State<'_, AppState>) -> Result<()> {
  let query_db = app_state.query_db.lock().await;
  if let Some(ref query_db) = *query_db {
    query_db.remove(key).unwrap();
  };
  Ok(())
}
