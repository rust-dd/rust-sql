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

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .setup(|app| {
      let app_handle = app.handle();

      tauri::async_runtime::spawn(async move {
        let app_dir = app_handle.path_resolver().app_data_dir().unwrap();
        let app_state = app_handle.state::<AppState>();
        let project_db = create_or_open_local_db(PROJECT_DB_PATH, &app_dir);
        let query_db = create_or_open_local_db(QUERY_DB_PATH, &app_dir);
        *app_state.project_db.lock().await = Some(project_db);
        *app_state.query_db.lock().await = Some(query_db);
      });

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
      dbs::project::delete_project,
      dbs::project::insert_project,
      dbs::project::select_projects,
      dbs::query::delete_query,
      dbs::query::insert_query,
      dbs::query::select_queries,
      drivers::postgresql::connector,
      drivers::postgresql::select_schema_tables,
      drivers::postgresql::select_sql_result,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
