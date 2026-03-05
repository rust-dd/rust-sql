// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod common;
mod dbs;
mod drivers;
mod terminal;
mod utils;

const LOCAL_DB_NAME: &str = "rsql.db";

use std::{collections::BTreeMap, sync::Arc};
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_postgres::Client;
use tracing::Level;

pub struct AppState {
    pub client: Arc<Mutex<Option<BTreeMap<String, Client>>>>,
    pub local_db: libsql::Database,
}

fn main() {
    tracing_subscriber::fmt()
        .with_file(true)
        .with_line_number(true)
        .with_level(true)
        .with_max_level(Level::INFO)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                let db_path = if cfg!(debug_assertions) {
                    LOCAL_DB_NAME.to_string()
                } else {
                    let app_dir = app_handle
                        .path()
                        .app_data_dir()
                        .expect("Failed to resolve app data directory");
                    std::fs::create_dir_all(&app_dir).ok();
                    app_dir.join(LOCAL_DB_NAME).to_string_lossy().to_string()
                };

                let db = libsql::Builder::new_local(&db_path)
                    .build()
                    .await
                    .expect("Failed to open local database");

                // Create tables
                let conn = db.connect().expect("Failed to create connection");
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        driver TEXT NOT NULL DEFAULT 'PGSQL',
                        username TEXT NOT NULL DEFAULT '',
                        password TEXT NOT NULL DEFAULT '',
                        database TEXT NOT NULL DEFAULT '',
                        host TEXT NOT NULL DEFAULT '',
                        port TEXT NOT NULL DEFAULT '',
                        ssl TEXT NOT NULL DEFAULT 'false'
                    )",
                    (),
                )
                .await
                .expect("Failed to create projects table");

                conn.execute(
                    "CREATE TABLE IF NOT EXISTS queries (
                        id TEXT PRIMARY KEY,
                        sql TEXT NOT NULL DEFAULT ''
                    )",
                    (),
                )
                .await
                .expect("Failed to create queries table");

                let state = AppState {
                    client: Arc::new(Mutex::new(Some(BTreeMap::new()))),
                    local_db: db,
                };
                app_handle.manage(state);

                let terminal_state = terminal::TerminalState {
                    sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
                };
                app_handle.manage(terminal_state);
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").expect("main window not found");
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
            drivers::pgsql::pgsql_load_schemas,
            drivers::pgsql::pgsql_load_tables,
            drivers::pgsql::pgsql_load_columns,
            drivers::pgsql::pgsql_load_column_details,
            drivers::pgsql::pgsql_load_indexes,
            drivers::pgsql::pgsql_load_constraints,
            drivers::pgsql::pgsql_load_triggers,
            drivers::pgsql::pgsql_load_rules,
            drivers::pgsql::pgsql_load_policies,
            drivers::pgsql::pgsql_load_views,
            drivers::pgsql::pgsql_load_materialized_views,
            drivers::pgsql::pgsql_load_functions,
            drivers::pgsql::pgsql_load_trigger_functions,
            drivers::pgsql::pgsql_run_query,
            drivers::pgsql::pgsql_load_activity,
            drivers::pgsql::pgsql_load_database_stats,
            drivers::pgsql::pgsql_load_table_stats,
            drivers::pgsql::pgsql_load_foreign_keys,
            drivers::pgsql::pgsql_run_query_packed,
            drivers::redshift::redshift_connector,
            drivers::redshift::redshift_load_schemas,
            drivers::redshift::redshift_load_tables,
            drivers::redshift::redshift_load_columns,
            drivers::redshift::redshift_load_column_details,
            drivers::redshift::redshift_load_indexes,
            drivers::redshift::redshift_load_constraints,
            drivers::redshift::redshift_load_triggers,
            drivers::redshift::redshift_load_rules,
            drivers::redshift::redshift_load_policies,
            drivers::redshift::redshift_load_views,
            drivers::redshift::redshift_load_materialized_views,
            drivers::redshift::redshift_load_functions,
            drivers::redshift::redshift_load_trigger_functions,
            drivers::redshift::redshift_run_query,
            drivers::redshift::redshift_load_activity,
            drivers::redshift::redshift_load_database_stats,
            drivers::redshift::redshift_load_table_stats,
            drivers::redshift::redshift_load_foreign_keys,
            drivers::redshift::redshift_run_query_packed,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            utils::compute_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
