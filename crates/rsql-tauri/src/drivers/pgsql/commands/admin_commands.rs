use rsql_core::AppState;
use rsql_core::drivers::pgsql::commands::admin;
use rsql_core::drivers::pgsql::roles_schema_objects::{DbGrant, PgRole, SchemaObject, TableGrant};
use rsql_core::error::AppError;

use tauri::State;
use tauri::ipc::Response;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_preview(
    file_path: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>), AppError> {
    admin::pgsql_csv_preview(file_path).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_import(
    project_id: &str,
    file_path: &str,
    schema: &str,
    table: &str,
    column_mapping: Vec<(usize, String)>,
    app_state: State<'_, AppState>,
) -> Result<usize, AppError> {
    admin::pgsql_csv_import(
        app_state.inner(),
        project_id,
        file_path,
        schema,
        table,
        column_mapping,
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_roles(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PgRole>, AppError> {
    admin::pgsql_load_roles(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<TableGrant>, AppError> {
    admin::pgsql_load_table_grants(app_state.inner(), project_id, role_name).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbGrant>, AppError> {
    admin::pgsql_load_database_grants(app_state.inner(), project_id, role_name).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_extract_schema_objects(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<SchemaObject>, AppError> {
    admin::pgsql_extract_schema_objects(app_state.inner(), project_id, schema).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = admin::pgsql_load_extensions(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_available_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = admin::pgsql_load_available_extensions(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_enum_types(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = admin::pgsql_load_enum_types(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_table_action(
    project_id: &str,
    action: &str,
    schema: &str,
    table: &str,
    object_type: &str,
    app_state: State<'_, AppState>,
) -> Result<String, AppError> {
    admin::pgsql_table_action(app_state.inner(), project_id, action, schema, table, object_type)
        .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_pg_settings(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = admin::pgsql_load_pg_settings(app_state.inner(), project_id).await?;
    Ok(Response::new(json))
}
