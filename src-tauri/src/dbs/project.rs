use crate::common::enums::AppError;
use crate::common::BTreeVecStore;
use crate::AppState;
use std::collections::BTreeMap;
use tauri::{Result, State};

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_select(app_state: State<'_, AppState>) -> Result<BTreeVecStore> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT id, driver, username, password, database, host, port, ssl FROM projects ORDER BY id",
            (),
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut projects = BTreeMap::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let id: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let driver: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let username: String = row
            .get(2)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let password: String = row
            .get(3)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let database: String = row
            .get(4)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let host: String = row
            .get(5)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let port: String = row
            .get(6)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let ssl: String = row
            .get(7)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        projects.insert(
            id,
            vec![driver, username, password, database, host, port, ssl],
        );
    }
    Ok(projects)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_insert(
    project_id: &str,
    project_details: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<()> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let driver = project_details.first().cloned().unwrap_or_default();
    let username = project_details.get(1).cloned().unwrap_or_default();
    let password = project_details.get(2).cloned().unwrap_or_default();
    let database = project_details.get(3).cloned().unwrap_or_default();
    let host = project_details.get(4).cloned().unwrap_or_default();
    let port = project_details.get(5).cloned().unwrap_or_default();
    let ssl = project_details
        .get(6)
        .cloned()
        .unwrap_or("false".to_string());

    conn.execute(
        "INSERT OR REPLACE INTO projects (id, driver, username, password, database, host, port, ssl)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        libsql::params![project_id, driver, username, password, database, host, port, ssl],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_delete(project_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM projects WHERE id = ?1",
        libsql::params![project_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    // Best-effort cleanup for in-memory connection state.
    app_state.clients.lock().await.remove(project_id);
    app_state.meta_clients.lock().await.remove(project_id);
    app_state.cancel_tokens.lock().await.remove(project_id);
    app_state.client_ssl.lock().await.remove(project_id);

    Ok(())
}
