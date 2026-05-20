use rsql_core::AppState;
use rsql_core::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use rsql_core::drivers::pgsql::commands::metadata;
use rsql_core::drivers::pgsql::{
    ColumnDetail, ConstraintDetail, FunctionInfo, IndexDetail, PolicyDetail, RuleDetail,
    TriggerDetail,
};
use rsql_core::error::AppError;

use tauri::{AppHandle, Manager, State};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_databases(
    project_id: &str,
    app: AppHandle,
) -> Result<Vec<String>, AppError> {
    let app_state = app.state::<AppState>();
    metadata::pgsql_load_databases(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_tablespaces(
    project_id: &str,
    app: AppHandle,
) -> Result<Vec<(String, String, String)>, AppError> {
    let app_state = app.state::<AppState>();
    metadata::pgsql_load_tablespaces(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas, AppError> {
    metadata::pgsql_load_schemas(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_tables(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadTables, AppError> {
    metadata::pgsql_load_tables(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_columns(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadColumns, AppError> {
    metadata::pgsql_load_columns(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_column_details(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ColumnDetail>, AppError> {
    metadata::pgsql_load_column_details(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_indexes(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<IndexDetail>, AppError> {
    metadata::pgsql_load_indexes(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_constraints(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ConstraintDetail>, AppError> {
    metadata::pgsql_load_constraints(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_triggers(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<TriggerDetail>, AppError> {
    metadata::pgsql_load_triggers(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_rules(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<RuleDetail>, AppError> {
    metadata::pgsql_load_rules(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_policies(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PolicyDetail>, AppError> {
    metadata::pgsql_load_policies(app_state.inner(), project_id, schema, table).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    metadata::pgsql_load_views(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_materialized_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    metadata::pgsql_load_materialized_views(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FunctionInfo>, AppError> {
    metadata::pgsql_load_functions(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_trigger_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, AppError> {
    metadata::pgsql_load_trigger_functions(app_state.inner(), project_id, schema).await
}
