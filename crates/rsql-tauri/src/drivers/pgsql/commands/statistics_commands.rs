use rsql_core::AppState;
use rsql_core::drivers::pgsql::{DbStat, FKDetail, ForeignKeyInfo, ObjectStats};
use rsql_core::drivers::pgsql::commands::statistics;
use rsql_core::error::AppError;

use tauri::State;
use tauri::ipc::Response;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_activity(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = statistics::pgsql_load_activity(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbStat>, AppError> {
    statistics::pgsql_load_database_stats(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = statistics::pgsql_load_table_stats(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_foreign_keys(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ForeignKeyInfo>, AppError> {
    statistics::pgsql_load_foreign_keys(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_table_statistics(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats, AppError> {
    statistics::pgsql_table_statistics(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fk_details(
    project_id: &str,
    schema: &str,
    table: &str,
    direction: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FKDetail>, AppError> {
    statistics::pgsql_fk_details(app_state.inner(), project_id, schema, table, direction).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_locks(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = statistics::pgsql_load_locks(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_index_usage(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = statistics::pgsql_load_index_usage(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_bloat(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = statistics::pgsql_load_table_bloat(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}
