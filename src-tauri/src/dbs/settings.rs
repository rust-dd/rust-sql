use std::collections::HashMap;

use crate::common::enums::AppError;
use crate::AppState;
use tauri::{Result, State};

#[tauri::command(rename_all = "snake_case")]
pub async fn settings_get_all(
    app_state: State<'_, AppState>,
) -> Result<HashMap<String, String>> {
    let conn = app_state.local_conn.lock().await;

    let mut rows = conn
        .query("SELECT key, value FROM settings", ())
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut map = HashMap::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let key: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let value: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        map.insert(key, value);
    }
    Ok(map)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn settings_get(key: &str, app_state: State<'_, AppState>) -> Result<Option<String>> {
    let conn = app_state.local_conn.lock().await;

    let mut rows = conn
        .query(
            "SELECT value FROM settings WHERE key = ?1",
            libsql::params![key],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    if let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let value: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn settings_set(
    key: &str,
    value: &str,
    app_state: State<'_, AppState>,
) -> Result<()> {
    let conn = app_state.local_conn.lock().await;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        libsql::params![key, value],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn settings_delete(key: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state.local_conn.lock().await;

    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        libsql::params![key],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
