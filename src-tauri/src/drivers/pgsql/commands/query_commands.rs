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

use super::CELL_SEP;
use super::pool_connection::{
    acquire_client, apply_statement_timeout, reset_statement_timeout, set_cancel_token,
};
use super::snapshot_persistence::{
    restore_virtual_from_snapshot, snapshot_cleanup_query, snapshot_load_page, snapshot_store_page,
    snapshot_upsert_metadata,
};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query(
    project_id: &str,
    sql: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let result = execute_query(&client, sql).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_cancel_query(project_id: &str, app_state: State<'_, AppState>) -> Result<bool> {
    let cancel_token = {
        let cancel_tokens = app_state.cancel_tokens.lock().await;
        cancel_tokens
            .get(project_id)
            .cloned()
            .ok_or_else(|| AppError::ClientNotConnected(project_id.to_string()))?
    };

    let use_ssl = {
        let client_ssl = app_state.client_ssl.lock().await;
        *client_ssl.get(project_id).unwrap_or(&false)
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
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let timeout = timeout_ms.unwrap_or(0);
    apply_statement_timeout(&client, timeout).await;
    let result = execute_query_packed(&client, sql).await;
    reset_statement_timeout(&client, timeout).await;

    let result = result?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_streamed(
    project_id: &str,
    sql: &str,
    stream_id: &str,
    app: AppHandle,
) -> Result<()> {
    let app_state = app.state::<AppState>();
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    execute_query_streamed(&client, sql, stream_id, &app)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_execute_virtual(
    project_id: &str,
    sql: &str,
    query_id: &str,
    page_size: usize,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let timeout = timeout_ms.unwrap_or(0);
    apply_statement_timeout(&client, timeout).await;
    let result =
        execute_virtual(&client, &app_state.virtual_cache, sql, query_id, page_size).await;
    reset_statement_timeout(&client, timeout).await;
    let result = result?;

    let col_count = if result.0.is_empty() {
        0
    } else {
        result.0.split(CELL_SEP).count()
    };
    if let Err(e) = snapshot_upsert_metadata(
        &app_state, project_id, query_id, sql, &result.0, result.1, page_size, col_count,
    )
    .await
    {
        tracing::warn!(
            "Failed to persist virtual snapshot metadata for {}: {:?}",
            query_id,
            e
        );
    }
    if let Err(e) = snapshot_store_page(&app_state, query_id, 0, &result.2).await {
        tracing::warn!(
            "Failed to persist virtual snapshot first page for {}: {:?}",
            query_id,
            e
        );
    }

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
    let page_index = if limit == 0 { 0 } else { offset / limit };

    match fetch_virtual_page(&app_state.virtual_cache, query_id, col_count, offset, limit).await {
        Ok(packed) => {
            if let Err(e) = snapshot_store_page(&app_state, query_id, page_index, &packed).await {
                tracing::warn!("Failed to persist fetched page for {}: {:?}", query_id, e);
            }
            let json =
                sonic_rs::to_string(&packed).map_err(|e| AppError::QueryFailed(e.to_string()))?;
            return Ok(Response::new(json));
        }
        Err(err) => {
            tracing::debug!(
                "Virtual cache miss for query {}, trying snapshot fallback: {:?}",
                query_id,
                err
            );
        }
    }

    if let Some(packed) = snapshot_load_page(&app_state, query_id, page_index).await? {
        let json =
            sonic_rs::to_string(&packed).map_err(|e| AppError::QueryFailed(e.to_string()))?;
        return Ok(Response::new(json));
    }

    if restore_virtual_from_snapshot(&app_state, query_id).await? {
        let packed =
            fetch_virtual_page(&app_state.virtual_cache, query_id, col_count, offset, limit)
                .await?;
        if let Err(e) = snapshot_store_page(&app_state, query_id, page_index, &packed).await {
            tracing::warn!(
                "Failed to persist restored page for {} (page {}): {:?}",
                query_id,
                page_index,
                e
            );
        }
        let json =
            sonic_rs::to_string(&packed).map_err(|e| AppError::QueryFailed(e.to_string()))?;
        return Ok(Response::new(json));
    }

    Err(AppError::QueryFailed(format!(
        "Virtual query {} not found in memory and no snapshot available",
        query_id
    ))
    .into())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_close_virtual(query_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    close_virtual(&app_state.virtual_cache, query_id).await?;
    if let Err(e) = snapshot_cleanup_query(&app_state, query_id).await {
        tracing::warn!(
            "Failed to cleanup virtual snapshot for {}: {:?}",
            query_id,
            e
        );
    }
    Ok(())
}
