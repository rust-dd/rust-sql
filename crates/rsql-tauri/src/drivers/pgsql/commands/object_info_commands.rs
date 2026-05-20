use rsql_core::AppState;
use rsql_core::drivers::pgsql::ObjectStats;
use rsql_core::drivers::pgsql::commands::object_info;
use rsql_core::error::AppError;

use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_view_info(
    project_id: &str,
    schema: &str,
    view: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats, AppError> {
    object_info::pgsql_view_info(app_state.inner(), project_id, schema, view).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_matview_info(
    project_id: &str,
    schema: &str,
    matview: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats, AppError> {
    object_info::pgsql_matview_info(app_state.inner(), project_id, schema, matview).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_function_info(
    project_id: &str,
    schema: &str,
    func_name: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats, AppError> {
    object_info::pgsql_function_info(app_state.inner(), project_id, schema, func_name).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_generate_ddl(
    project_id: &str,
    schema: &str,
    name: &str,
    object_type: &str,
    app_state: State<'_, AppState>,
) -> Result<String, AppError> {
    object_info::pgsql_generate_ddl(app_state.inner(), project_id, schema, name, object_type).await
}
