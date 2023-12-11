use std::collections::HashMap;

use serde::Serialize;
use tauri::Result;

#[derive(Default, Serialize)]
pub struct QueryDetails {
  pub title: String,
  pub sql: String,
}

#[tauri::command]
pub fn insert_query(key: String, sql: String) {
  todo!()
}

#[tauri::command]
pub async fn select_queries() -> Result<HashMap<String, String>> {
  todo!()
}

#[tauri::command]
pub async fn delete_query(key: String) {
  todo!()
}
