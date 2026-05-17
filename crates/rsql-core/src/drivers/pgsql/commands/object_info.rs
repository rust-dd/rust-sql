use crate::AppState;
use crate::drivers::pgsql::ddl_generation::generate_full_ddl;
use crate::drivers::pgsql::metadata_views_functions::{
    load_function_info, load_matview_info, load_view_info,
};
use crate::drivers::pgsql::ObjectStats;
use crate::error::AppError;

use super::pool_helpers::acquire_client;

pub async fn pgsql_view_info(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    view: &str,
) -> Result<ObjectStats, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_view_info(&client, schema, view).await
}

pub async fn pgsql_matview_info(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    matview: &str,
) -> Result<ObjectStats, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_matview_info(&client, schema, matview).await
}

pub async fn pgsql_function_info(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    func_name: &str,
) -> Result<ObjectStats, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_function_info(&client, schema, func_name).await
}

pub async fn pgsql_generate_ddl(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    name: &str,
    object_type: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    generate_full_ddl(&client, schema, name, object_type).await
}
