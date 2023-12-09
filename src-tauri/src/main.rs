// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod constant;
mod postgres;
mod project_db;
mod query_db;
mod utils;

use postgres::{get_schema_tables, get_sql_result, pg_connector};
use project_db::{get_project_details, get_projects, remove_project};
use sled::Db;
use std::sync::Arc;
#[cfg(debug_assertions)]
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_postgres::Client;

pub struct AppState {
  pub connection_strings: Arc<Mutex<String>>,
  pub client: Arc<Mutex<Option<Client>>>,
  pub project_db: Arc<Mutex<Option<Db>>>,
  pub query_db: Arc<Mutex<Option<Db>>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      connection_strings: Arc::new(Mutex::new(String::new())),
      client: Arc::new(Mutex::new(None)),
      project_db: Arc::new(Mutex::new(None)),
      query_db: Arc::new(Mutex::new(None)),
    }
  }
}

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .setup(|app| {
      // open devtools if we are in debug mode
      #[cfg(debug_assertions)]
      {
        let window = app.get_window("main").unwrap();
        window.open_devtools();
        window.close_devtools();
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_projects,
      get_project_details,
      get_schema_tables,
      pg_connector,
      get_sql_result,
      remove_project,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

