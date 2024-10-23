// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dbs;
mod drivers;
mod utils;

const PROJECT_DB_PATH: &str = "project_db";
const QUERY_DB_PATH: &str = "query_db";

use sled::Db;
use std::{collections::BTreeMap, sync::Arc};
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_postgres::Client;
use tracing::Level;
use utils::create_or_open_local_db;

pub struct AppState {
  pub client: Arc<Mutex<Option<BTreeMap<String, Client>>>>,
  pub project_db: Arc<Mutex<Option<Db>>>,
  pub query_db: Arc<Mutex<Option<Db>>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      client: Arc::new(Mutex::new(Some(BTreeMap::new()))),
      project_db: Arc::new(Mutex::new(None)),
      query_db: Arc::new(Mutex::new(None)),
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tracing_subscriber::fmt()
    .with_file(true)
    .with_line_number(true)
    .with_level(true)
    .with_max_level(Level::INFO)
    .init();

  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .manage(AppState::default())
    .setup(|app| {
      let app_handle = app.handle().clone();

      tauri::async_runtime::spawn(async move {
        let app_dir = app_handle.path().app_data_dir().unwrap();
        let app_state = app_handle.state::<AppState>();
        let project_db = create_or_open_local_db(PROJECT_DB_PATH, &app_dir);
        let query_db = create_or_open_local_db(QUERY_DB_PATH, &app_dir);
        *app_state.project_db.lock().await = Some(project_db);
        *app_state.query_db.lock().await = Some(query_db);
      });

      // open devtools if we are in debug mode
      #[cfg(debug_assertions)]
      {
        let window = app.get_webview_window("main").unwrap();
        window.open_devtools();
        window.close_devtools();
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      dbs::project::project_db_select,
      dbs::project::project_db_insert,
      dbs::project::project_db_delete,
      dbs::query::query_db_select,
      dbs::query::query_db_insert,
      dbs::query::query_db_delete,
      drivers::pgsql::pgsql_connector,
      drivers::pgsql::pgsql_load_relations,
      drivers::pgsql::pgsql_load_schemas,
      drivers::pgsql::pgsql_load_tables,
      drivers::pgsql::pgsql_run_query,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
