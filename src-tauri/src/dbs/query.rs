use std::collections::BTreeMap;
use tauri::{AppHandle, Manager, Result, State};
use crate::common::enums::AppError;
use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_select(app_state: State<'_, AppState>) -> Result<BTreeMap<String, String>> {
    let conn = app_state.local_db.connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query("SELECT id, sql FROM queries ORDER BY id", ())
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut queries = BTreeMap::new();
    while let Some(row) = rows.next().await.map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let id: String = row.get(0).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let sql: String = row.get(1).map_err(|e| AppError::DatabaseError(e.to_string()))?;
        queries.insert(id, sql);
    }
    Ok(queries)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_insert(query_id: &str, sql: &str, app: AppHandle) -> Result<()> {
    let app_state = app.state::<AppState>();
    let conn = app_state.local_db.connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "INSERT OR REPLACE INTO queries (id, sql) VALUES (?1, ?2)",
        libsql::params![query_id, sql],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_delete(query_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state.local_db.connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute("DELETE FROM queries WHERE id = ?1", libsql::params![query_id])
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
