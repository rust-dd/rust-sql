use rsql_core::AppState;
use rsql_core::drivers::pgsql::commands::query;
use rsql_core::error::AppError;

use tauri::ipc::Response;
use tauri::{AppHandle, Manager, State};

use rsql_core::drivers::pgsql::streaming::execute_query_streamed;

use super::pool_connection::{acquire_client, set_cancel_token};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query(
    project_id: &str,
    sql: &str,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = query::pgsql_run_query(app_state.inner(), project_id, sql).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_cancel_query(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<bool, AppError> {
    query::pgsql_cancel_query(app_state.inner(), project_id).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_packed(
    project_id: &str,
    sql: &str,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = query::pgsql_run_query_packed(app_state.inner(), project_id, sql, timeout_ms).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_streamed(
    project_id: &str,
    sql: &str,
    stream_id: &str,
    app: AppHandle,
) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let sink = crate::event_sink::TauriEventSink::new(app.clone());
    execute_query_streamed(&client, sql, stream_id, &sink).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_execute_virtual(
    project_id: &str,
    sql: &str,
    query_id: &str,
    page_size: usize,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json = query::pgsql_execute_virtual(
        app_state.inner(),
        project_id,
        sql,
        query_id,
        page_size,
        timeout_ms,
    )
    .await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fetch_page(
    query_id: &str,
    col_count: usize,
    offset: usize,
    limit: usize,
    app_state: State<'_, AppState>,
) -> Result<Response, AppError> {
    let json =
        query::pgsql_fetch_page(app_state.inner(), query_id, col_count, offset, limit).await?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_close_virtual(
    query_id: &str,
    app_state: State<'_, AppState>,
) -> Result<(), AppError> {
    query::pgsql_close_virtual(app_state.inner(), query_id).await
}
