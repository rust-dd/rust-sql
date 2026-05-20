use rsql_core::AppState;
use rsql_core::drivers::pgsql::commands::connection;
use rsql_core::error::{AppError, ProjectConnectionStatus};

use tauri::{AppHandle, Manager};

pub(crate) use rsql_core::drivers::pgsql::commands::pool_helpers::{
    acquire_client, set_cancel_token,
};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_test_connection(key: [&str; 6]) -> Result<String, AppError> {
    connection::pgsql_test_connection(key).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_connector(
    project_id: &str,
    key: Option<[&str; 6]>,
    ssh: Option<Vec<String>>,
    app: AppHandle,
) -> Result<ProjectConnectionStatus, AppError> {
    let app_state = app.state::<AppState>();
    connection::pgsql_connector(app_state.inner(), project_id, key, ssh).await
}
