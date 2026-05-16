use crate::AppState;
use crate::common::enums::AppError;
use crate::drivers::pgsql::{
    DbStat, FKDetail, ForeignKeyInfo, ObjectStats, load_active_locks, load_activity,
    load_database_stats, load_fk_details, load_foreign_keys, load_index_usage, load_table_bloat,
    load_table_statistics, load_table_stats,
};

use tauri::ipc::Response;
use tauri::{Result, State};

use super::pool_connection::acquire_client;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_activity(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    let result = load_activity(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbStat>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_database_stats(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    let result = load_table_stats(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_foreign_keys(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ForeignKeyInfo>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_foreign_keys(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_table_statistics(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_statistics(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fk_details(
    project_id: &str,
    schema: &str,
    table: &str,
    direction: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FKDetail>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_fk_details(&client, schema, table, direction)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_locks(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_active_locks(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_index_usage(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_index_usage(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_bloat(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_table_bloat(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}
