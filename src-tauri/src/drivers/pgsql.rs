use std::sync::Arc;

use crate::common::enums::{AppError, ProjectConnectionStatus};
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::drivers::common::{
    execute_query, execute_query_packed, execute_query_streamed, execute_virtual, fetch_virtual_page,
    close_virtual, get_client, load_activity, load_column_details, load_columns,
    load_constraints, load_database_stats, load_foreign_keys, load_functions, load_indexes,
    load_materialized_views, load_policies, load_rules, load_schemas, load_table_stats, load_tables,
    load_trigger_functions, load_triggers, load_views, ColumnDetail, ConstraintDetail, DbStat,
    ForeignKeyInfo, FunctionInfo, IndexDetail, PolicyDetail, RuleDetail, TriggerDetail,
};
use crate::AppState;

use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tauri::{AppHandle, Manager, Result, State};
use tokio::{sync::Mutex, time as tokio_time};
use tokio_postgres::{Config, NoTls};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_connector(
    project_id: &str,
    key: Option<[&str; 6]>,
    app: AppHandle,
) -> Result<ProjectConnectionStatus> {
    let app_state = app.state::<AppState>();
    {
        let clients = app_state.client.lock().await;
        let client_map = clients
            .as_ref()
            .ok_or(AppError::DatabaseError("No client map".into()))?;

        if client_map.contains_key(project_id) {
            return Ok(ProjectConnectionStatus::Connected);
        }
    }

    let (user, password, database, host, port_str, use_ssl) = match key {
        Some(key) => (
            key[0].to_string(),
            key[1].to_string(),
            key[2].to_string(),
            key[3].to_string(),
            key[4].to_string(),
            key[5] == "true",
        ),
        None => {
            let conn = app_state.local_db.connect()
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let mut rows = conn
                .query(
                    "SELECT username, password, database, host, port, ssl FROM projects WHERE id = ?1",
                    libsql::params![project_id],
                )
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let row = rows
                .next()
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?
                .ok_or_else(|| AppError::ProjectNotFound(project_id.to_string()))?;
            (
                row.get::<String>(0).unwrap_or_default(),
                row.get::<String>(1).unwrap_or_default(),
                row.get::<String>(2).unwrap_or_default(),
                row.get::<String>(3).unwrap_or_default(),
                row.get::<String>(4).unwrap_or_default(),
                row.get::<String>(5).map(|s| s == "true").unwrap_or(false),
            )
        }
    };

    let port: u16 = port_str.parse().unwrap_or(5432);
    let mut cfg = Config::new();
    cfg.user(&user)
        .password(&password)
        .dbname(&database)
        .host(&host)
        .port(port);

    let is_connection_error = Arc::new(Mutex::new(false));
    let client = if use_ssl {
        let tls_connector = TlsConnector::builder()
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
        let tls = MakeTlsConnector::new(tls_connector);
        let connection = tokio_time::timeout(tokio_time::Duration::from_secs(10), cfg.connect(tls))
            .await
            .map_err(|_| AppError::ConnectionTimeout);

        match connection {
            Ok(Ok((client, connection))) => {
                tokio::spawn({
                    let flag = Arc::clone(&is_connection_error);
                    async move {
                        if let Err(e) = connection.await {
                            tracing::error!("Postgres TLS connection error: {:?}", e);
                            *flag.lock().await = true;
                        }
                    }
                });
                client
            }
            Ok(Err(e)) => {
                tracing::error!("Postgres TLS connection error: {:?}", e);
                return Ok(ProjectConnectionStatus::Failed);
            }
            Err(_) => {
                tracing::error!("Postgres TLS connection timeout");
                return Ok(ProjectConnectionStatus::Failed);
            }
        }
    } else {
        let connection = tokio_time::timeout(tokio_time::Duration::from_secs(10), cfg.connect(NoTls))
            .await
            .map_err(|_| AppError::ConnectionTimeout);

        match connection {
            Ok(Ok((client, connection))) => {
                tokio::spawn({
                    let flag = Arc::clone(&is_connection_error);
                    async move {
                        if let Err(e) = connection.await {
                            tracing::error!("Postgres connection error: {:?}", e);
                            *flag.lock().await = true;
                        }
                    }
                });
                client
            }
            Ok(Err(e)) => {
                tracing::error!("Postgres connection error: {:?}", e);
                return Ok(ProjectConnectionStatus::Failed);
            }
            Err(_) => {
                tracing::error!("Postgres connection timeout");
                return Ok(ProjectConnectionStatus::Failed);
            }
        }
    };

    if *is_connection_error.lock().await {
        return Ok(ProjectConnectionStatus::Failed);
    }

    let client = Arc::new(client);

    {
        let mut clients = app_state.client.lock().await;
        let client_map = clients
            .as_mut()
            .ok_or(AppError::DatabaseError("No client map".into()))?;
        client_map.insert(project_id.to_string(), Arc::clone(&client));
    }

    {
        let mut cancel_tokens = app_state.cancel_tokens.lock().await;
        cancel_tokens.insert(project_id.to_string(), client.cancel_token());
    }

    {
        let mut client_ssl = app_state.client_ssl.lock().await;
        client_ssl.insert(project_id.to_string(), use_ssl);
    }

    Ok(ProjectConnectionStatus::Connected)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_schemas(
        &client,
        r#"SELECT schema_name FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
           ORDER BY schema_name"#,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_tables(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadTables> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_tables(
        &client,
        r#"SELECT table_name,
                  pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS size
           FROM information_schema.tables
           WHERE table_schema = $1
           ORDER BY table_name"#,
        schema,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_columns(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadColumns> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_columns(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_column_details(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ColumnDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_column_details(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_indexes(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<IndexDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_indexes(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_constraints(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ConstraintDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_constraints(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_triggers(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<TriggerDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_triggers(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_rules(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<RuleDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_rules(&client, schema, table).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_policies(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PolicyDetail>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_policies(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_views(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_materialized_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_materialized_views(&client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FunctionInfo>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_functions(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_trigger_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_trigger_functions(&client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query(
    project_id: &str,
    sql: &str,
    app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32)> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    execute_query(&client, sql).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_cancel_query(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<bool> {
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
    app_state: State<'_, AppState>,
) -> Result<(String, f32)> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    execute_query_packed(&client, sql).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query_streamed(
    project_id: &str,
    sql: &str,
    stream_id: &str,
    app: AppHandle,
) -> Result<()> {
    let client = {
        let app_state = app.state::<AppState>();
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    execute_query_streamed(&client, sql, stream_id, &app)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_activity(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<Vec<String>>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_activity(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbStat>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_database_stats(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<Vec<String>>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_table_stats(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_foreign_keys(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ForeignKeyInfo>> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    load_foreign_keys(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_execute_virtual(
    project_id: &str,
    sql: &str,
    query_id: &str,
    page_size: usize,
    app_state: State<'_, AppState>,
) -> Result<(String, usize, String, f32)> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    execute_virtual(&client, sql, query_id, page_size)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fetch_page(
    project_id: &str,
    query_id: &str,
    offset: usize,
    limit: usize,
    app_state: State<'_, AppState>,
) -> Result<String> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    fetch_virtual_page(&client, query_id, offset, limit)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_close_virtual(
    project_id: &str,
    query_id: &str,
    app_state: State<'_, AppState>,
) -> Result<()> {
    let client = {
        let clients = app_state.client.lock().await;
        let client_map = clients.as_ref().ok_or(AppError::DatabaseError("No client map".into()))?;
        get_client(client_map, project_id)?
    };

    close_virtual(&client, query_id)
        .await
        .map_err(Into::into)
}
