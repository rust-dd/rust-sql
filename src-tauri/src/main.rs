// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod postgres;

use postgres::{get_schema_tables, get_sql_result, pg_connector};
use sqlx::PgPool;
use std::sync::Arc;
#[cfg(debug_assertions)]
use tauri::Manager;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub connection_strings: Arc<Mutex<String>>,
    pub pool: Arc<Mutex<Option<PgPool>>>,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_schema_tables,
            pg_connector,
            get_sql_result
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

