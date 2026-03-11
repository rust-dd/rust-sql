use crate::common::enums::AppError;
use crate::AppState;
use tauri::{Result, State};

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_save(name: &str, tabs: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state.local_conn.lock().await;

    conn.execute(
        "INSERT OR REPLACE INTO workspaces (name, tabs) VALUES (?1, ?2)",
        libsql::params![name, tabs],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_load_all(app_state: State<'_, AppState>) -> Result<Vec<(String, String)>> {
    let conn = app_state.local_conn.lock().await;

    let mut rows = conn
        .query("SELECT name, tabs FROM workspaces ORDER BY name", ())
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut workspaces = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let name: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let tabs: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        workspaces.push((name, tabs));
    }
    Ok(workspaces)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_delete(name: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state.local_conn.lock().await;

    conn.execute(
        "DELETE FROM workspaces WHERE name = ?1",
        libsql::params![name],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
