use crate::AppState;
use crate::common::enums::AppError;
use crate::drivers::pgsql::{
    close_virtual, execute_query, execute_query_packed, execute_query_streamed, execute_virtual,
    fetch_virtual_page,
};

use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager, Result, State};
use tokio_postgres::NoTls;

use super::pool_connection::{
    acquire_client, apply_statement_timeout, clear_cancel_token, reset_statement_timeout,
    set_cancel_token,
};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query(
    project_id: &str,
    sql: &str,
    exec_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, exec_id, project_id, client.cancel_token()).await;

    let result = execute_query(&client, sql).await;
    clear_cancel_token(&app_state, exec_id).await;
    let result = result?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_cancel_query(exec_id: &str, app_state: State<'_, AppState>) -> Result<bool> {
    let (project_id, cancel_token) = {
        let cancel_tokens = app_state.cancel_tokens.lock().await;
        match cancel_tokens.get(exec_id) {
            Some(entry) => entry.clone(),
            // The query already finished; nothing to cancel is not an error.
            None => return Ok(false),
        }
    };

    let use_ssl = {
        let client_ssl = app_state.client_ssl.lock().await;
        *client_ssl.get(&project_id).unwrap_or(&false)
    };

    if use_ssl {
        let tls_connector = TlsConnector::builder()
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
        let tls = MakeTlsConnector::new(tls_connector);
        cancel_token
            .cancel_query(tls)
            .await
            .map_err(|e| AppError::QueryFailed(format!("Failed to cancel query: {e}")))?;
    } else {
        cancel_token
            .cancel_query(NoTls)
            .await
            .map_err(|e| AppError::QueryFailed(format!("Failed to cancel query: {e}")))?;
    }

    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_packed(
    project_id: &str,
    sql: &str,
    exec_id: &str,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, exec_id, project_id, client.cancel_token()).await;

    let timeout = timeout_ms.unwrap_or(0);
    apply_statement_timeout(&client, timeout).await;
    let result = execute_query_packed(&client, sql).await;
    reset_statement_timeout(&client, timeout).await;
    clear_cancel_token(&app_state, exec_id).await;

    let result = result?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_streamed(
    project_id: &str,
    sql: &str,
    stream_id: &str,
    exec_id: &str,
    app: AppHandle,
) -> Result<()> {
    let app_state = app.state::<AppState>();
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, exec_id, project_id, client.cancel_token()).await;

    let result = execute_query_streamed(&client, sql, stream_id, &app).await;
    clear_cancel_token(&app_state, exec_id).await;
    result.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_execute_virtual(
    project_id: &str,
    sql: &str,
    query_id: &str,
    exec_id: &str,
    page_size: usize,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, exec_id, project_id, client.cancel_token()).await;

    let timeout = timeout_ms.unwrap_or(0);
    apply_statement_timeout(&client, timeout).await;
    let result = execute_virtual(&client, &app_state.virtual_cache, sql, query_id, page_size).await;
    reset_statement_timeout(&client, timeout).await;
    clear_cancel_token(&app_state, exec_id).await;
    let result = result?;

    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fetch_page(
    query_id: &str,
    col_count: usize,
    offset: usize,
    limit: usize,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let packed =
        fetch_virtual_page(&app_state.virtual_cache, query_id, col_count, offset, limit).await?;
    let json = sonic_rs::to_string(&packed).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_close_virtual(query_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    close_virtual(&app_state.virtual_cache, query_id).await?;
    Ok(())
}
