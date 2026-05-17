use rsql_core::AppState;
use rsql_core::common::BTreeVecStore;
use rsql_core::error::AppError;
use std::collections::BTreeMap;
use tauri::{AppHandle, Manager, State};

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_select(
    app_state: State<'_, AppState>,
) -> Result<BTreeVecStore, AppError> {
    rsql_core::state::project::project_db_select(&app_state.local_db).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_insert(
    project_id: &str,
    project_details: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<(), AppError> {
    rsql_core::state::project::project_db_insert(
        &app_state.local_db,
        project_id,
        project_details,
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_delete(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<(), AppError> {
    rsql_core::state::project::project_db_delete(&app_state.local_db, project_id).await?;
    app_state.clients.lock().await.remove(project_id);
    app_state.meta_clients.lock().await.remove(project_id);
    app_state.cancel_tokens.lock().await.remove(project_id);
    app_state.client_ssl.lock().await.remove(project_id);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_select(
    app_state: State<'_, AppState>,
) -> Result<BTreeMap<String, String>, AppError> {
    rsql_core::state::query::query_db_select(&app_state.local_db).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_insert(query_id: &str, sql: &str, app: AppHandle) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    rsql_core::state::query::query_db_insert(&app_state.local_db, query_id, sql).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn query_db_delete(
    query_id: &str,
    app_state: State<'_, AppState>,
) -> Result<(), AppError> {
    rsql_core::state::query::query_db_delete(&app_state.local_db, query_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_save(
    name: &str,
    tabs: &str,
    app_state: State<'_, AppState>,
) -> Result<(), AppError> {
    rsql_core::state::workspace::workspace_save(&app_state.local_db, name, tabs).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_load_all(
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, AppError> {
    rsql_core::state::workspace::workspace_load_all(&app_state.local_db).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn workspace_delete(name: &str, app_state: State<'_, AppState>) -> Result<(), AppError> {
    rsql_core::state::workspace::workspace_delete(&app_state.local_db, name).await
}
