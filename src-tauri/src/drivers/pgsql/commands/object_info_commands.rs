use crate::AppState;
use crate::drivers::pgsql::{
    ObjectStats, generate_full_ddl, load_function_info, load_matview_info, load_view_info,
};

use tauri::{Result, State};

use super::pool_connection::acquire_client;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_view_info(
    project_id: &str,
    schema: &str,
    view: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_view_info(&client, schema, view)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_matview_info(
    project_id: &str,
    schema: &str,
    matview: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_matview_info(&client, schema, matview)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_function_info(
    project_id: &str,
    schema: &str,
    func_name: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_function_info(&client, schema, func_name)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_generate_ddl(
    project_id: &str,
    schema: &str,
    name: &str,
    object_type: &str,
    app_state: State<'_, AppState>,
) -> Result<String> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    generate_full_ddl(&client, schema, name, object_type)
        .await
        .map_err(Into::into)
}
