// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod common;
mod dbs;
mod drivers;
mod terminal;
mod utils;

const LOCAL_DB_NAME: &str = "rsql.db";

use std::{collections::BTreeMap, sync::Arc};
use tauri::menu::{AboutMetadata, MenuBuilder, SubmenuBuilder};
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_postgres::{CancelToken, Client};
use tracing::Level;

pub struct AppState {
    pub clients: Arc<Mutex<BTreeMap<String, Arc<Client>>>>,
    pub meta_clients: Arc<Mutex<BTreeMap<String, Arc<Client>>>>,
    pub cancel_tokens: Arc<Mutex<BTreeMap<String, CancelToken>>>,
    pub client_ssl: Arc<Mutex<BTreeMap<String, bool>>>,
    pub local_db: libsql::Database,
    pub resource_monitor: Arc<Mutex<utils::ResourceMonitor>>,
    pub virtual_cache: Arc<Mutex<drivers::common::VirtualCache>>,
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

                conn.execute(
                    "CREATE TABLE IF NOT EXISTS workspaces (
                        name TEXT PRIMARY KEY,
                        tabs TEXT NOT NULL DEFAULT '[]'
                    )",
                    (),
                )
                .await
                .expect("Failed to create workspaces table");

                let state = AppState {
                    clients: Arc::new(Mutex::new(BTreeMap::new())),
                    meta_clients: Arc::new(Mutex::new(BTreeMap::new())),
                    cancel_tokens: Arc::new(Mutex::new(BTreeMap::new())),
                    client_ssl: Arc::new(Mutex::new(BTreeMap::new())),
                    local_db: db,
                    resource_monitor: Arc::new(Mutex::new(utils::ResourceMonitor::new())),
                    virtual_cache: Arc::new(Mutex::new(BTreeMap::new())),
                };
                app_handle.manage(state);

                let terminal_state = terminal::TerminalState {
                    sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
                };
                app_handle.manage(terminal_state);
            });

            // Native menu
            let handle = app.handle();

            let app_menu = SubmenuBuilder::new(handle, "RSQL")
                .about(Some(AboutMetadata {
                    name: Some("RSQL".into()),
                    version: Some(env!("CARGO_PKG_VERSION").into()),
                    copyright: Some("\u{00a9} 2025 rust-dd".into()),
                    comments: Some(
                        "Modern SQL client for PostgreSQL.\nBuilt with Tauri, React, and Rust."
                            .into(),
                    ),
                    website: Some("https://github.com/rust-dd/rsql".into()),
                    website_label: Some("GitHub".into()),
                    ..Default::default()
                }))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(handle, "View").fullscreen().build()?;

            let window_menu = SubmenuBuilder::new(handle, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                .build()?;

            handle.set_menu(menu)?;

            #[cfg(debug_assertions)]
            {
                let window = app
                    .get_webview_window("main")
                    .expect("main window not found");
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
            dbs::workspace::workspace_save,
            dbs::workspace::workspace_load_all,
            dbs::workspace::workspace_delete,
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
            drivers::pgsql::pgsql_cancel_query,
            drivers::pgsql::pgsql_load_activity,
            drivers::pgsql::pgsql_load_database_stats,
            drivers::pgsql::pgsql_load_table_stats,
            drivers::pgsql::pgsql_load_foreign_keys,
            drivers::pgsql::pgsql_run_query_packed,
            drivers::pgsql::pgsql_run_query_streamed,
            drivers::pgsql::pgsql_execute_virtual,
            drivers::pgsql::pgsql_fetch_page,
            drivers::pgsql::pgsql_close_virtual,
            terminal::terminal_spawn,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_kill,
            utils::compute_diff,
            utils::system_resource_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
