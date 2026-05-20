use crate::AppState;
use crate::drivers::pgsql::statistics_activity::{
    load_active_locks, load_activity, load_database_stats, load_fk_details, load_foreign_keys,
    load_index_usage, load_table_bloat, load_table_statistics, load_table_stats,
};
use crate::drivers::pgsql::{DbStat, FKDetail, ForeignKeyInfo, ObjectStats};
use crate::error::AppError;

use super::pool_helpers::acquire_client;

pub async fn pgsql_load_activity(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_activity(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_database_stats(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<DbStat>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_database_stats(&client).await
}

pub async fn pgsql_load_table_stats(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_table_stats(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_foreign_keys(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<ForeignKeyInfo>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_foreign_keys(&client, schema).await
}

pub async fn pgsql_table_statistics(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<ObjectStats, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_statistics(&client, schema, table).await
}

pub async fn pgsql_fk_details(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
    direction: &str,
) -> Result<Vec<FKDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_fk_details(&client, schema, table, direction).await
}

pub async fn pgsql_load_locks(app_state: &AppState, project_id: &str) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_active_locks(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_index_usage(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_index_usage(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_table_bloat(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_table_bloat(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}
