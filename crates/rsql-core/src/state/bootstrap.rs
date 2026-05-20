use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::utils::ResourceMonitor;
use super::AppState;

pub async fn bootstrap(db_path: &str) -> Result<AppState, AppError> {
    let db = libsql::Builder::new_local(db_path)
        .build()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let conn = db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

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
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS queries (
            id TEXT PRIMARY KEY,
            sql TEXT NOT NULL DEFAULT ''
        )",
        (),
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspaces (
            name TEXT PRIMARY KEY,
            tabs TEXT NOT NULL DEFAULT '[]'
        )",
        (),
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS virtual_query_snapshots (
            query_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            sql TEXT NOT NULL,
            columns_packed TEXT NOT NULL DEFAULT '',
            total_rows INTEGER NOT NULL DEFAULT 0,
            page_size INTEGER NOT NULL DEFAULT 0,
            col_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        (),
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS virtual_query_pages (
            query_id TEXT NOT NULL,
            page_index INTEGER NOT NULL,
            packed_page TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (query_id, page_index)
        )",
        (),
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_pages
         WHERE query_id NOT IN (SELECT query_id FROM virtual_query_snapshots)",
        (),
    )
    .await
    .ok();

    for col in [
        "ssh_enabled",
        "ssh_host",
        "ssh_port",
        "ssh_user",
        "ssh_password",
        "ssh_key_path",
    ] {
        conn.execute(
            &format!("ALTER TABLE projects ADD COLUMN {col} TEXT NOT NULL DEFAULT ''"),
            (),
        )
        .await
        .ok();
    }

    Ok(AppState {
        clients: Arc::new(Mutex::new(BTreeMap::new())),
        meta_clients: Arc::new(Mutex::new(BTreeMap::new())),
        cancel_tokens: Arc::new(Mutex::new(BTreeMap::new())),
        client_ssl: Arc::new(Mutex::new(BTreeMap::new())),
        local_db: db,
        resource_monitor: Arc::new(Mutex::new(ResourceMonitor::new())),
        virtual_cache: Arc::new(Mutex::new(BTreeMap::new())),
        notify_handles: Arc::new(Mutex::new(BTreeMap::new())),
        ssh_tunnels: Arc::new(Mutex::new(BTreeMap::new())),
    })
}
