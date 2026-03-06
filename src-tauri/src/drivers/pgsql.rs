use std::{collections::BTreeMap, sync::Arc};

use deadpool_postgres::{Manager as PgManager, ManagerConfig, Pool, RecyclingMethod};

use crate::common::enums::{AppError, ProjectConnectionStatus};
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::drivers::common::{
    close_virtual, execute_query, execute_query_packed, execute_query_streamed, execute_virtual,
    fetch_virtual_page, get_pool, load_activity, load_column_details, load_columns,
    load_constraints, load_database_stats, load_foreign_keys, load_functions, load_indexes,
    load_materialized_views, load_policies, load_rules, load_schemas, load_table_stats,
    load_tables, load_trigger_functions, load_triggers, load_views, ColumnDetail, ConstraintDetail,
    DbStat, ForeignKeyInfo, FunctionInfo, IndexDetail, PolicyDetail, RuleDetail, TriggerDetail,
};
use crate::AppState;

use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager, Result, State};
use tokio_postgres::{CancelToken, Config, NoTls};

fn create_pg_pool(
    cfg: &Config,
    use_ssl: bool,
    max_size: usize,
) -> std::result::Result<Pool, AppError> {
    let manager_config = ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    };

    if use_ssl {
        let tls_connector = TlsConnector::builder()
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
        let tls = MakeTlsConnector::new(tls_connector);
        let manager = PgManager::from_config(cfg.clone(), tls, manager_config);
        Pool::builder(manager)
            .max_size(max_size)
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))
    } else {
        let manager = PgManager::from_config(cfg.clone(), NoTls, manager_config);
        Pool::builder(manager)
            .max_size(max_size)
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))
    }
}

async fn acquire_client(
    pools_mutex: &tokio::sync::Mutex<BTreeMap<String, Arc<Pool>>>,
    project_id: &str,
) -> std::result::Result<deadpool_postgres::Client, AppError> {
    let pool = {
        let pools = pools_mutex.lock().await;
        get_pool(&pools, project_id)?
    };

    pool.get()
        .await
        .map_err(|e| AppError::ConnectionFailed(e.to_string()))
}

async fn set_cancel_token(
    app_state: &AppState,
    project_id: &str,
    token: CancelToken,
) -> std::result::Result<(), AppError> {
    let mut cancel_tokens = app_state.cancel_tokens.lock().await;
    cancel_tokens.insert(project_id.to_string(), token);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_connector(
    project_id: &str,
    key: Option<[&str; 6]>,
    app: AppHandle,
) -> Result<ProjectConnectionStatus> {
    let app_state = app.state::<AppState>();
    {
        let clients = app_state.clients.lock().await;
        if clients.contains_key(project_id) {
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
            let conn = app_state
                .local_db
                .connect()
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

    // Create two pools: one for user queries, one for metadata.
    let query_pool = match create_pg_pool(&cfg, use_ssl, 16) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Query pool creation failed: {:?}", e);
            return Ok(ProjectConnectionStatus::Failed);
        }
    };
    let meta_pool = match create_pg_pool(&cfg, use_ssl, 8) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Meta pool creation failed: {:?}", e);
            return Ok(ProjectConnectionStatus::Failed);
        }
    };

    // Validate connectivity eagerly so connector keeps previous fail/connected behavior.
    let query_client = match query_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Query pool initial connection failed: {:?}", e);
            return Ok(ProjectConnectionStatus::Failed);
        }
    };
    if let Err(e) = meta_pool.get().await {
        tracing::error!("Meta pool initial connection failed: {:?}", e);
        return Ok(ProjectConnectionStatus::Failed);
    }

    {
        let mut clients = app_state.clients.lock().await;
        clients.insert(project_id.to_string(), Arc::clone(&query_pool));
    }
    {
        let mut meta_clients = app_state.meta_clients.lock().await;
        meta_clients.insert(project_id.to_string(), Arc::clone(&meta_pool));
    }
    {
        let mut cancel_tokens = app_state.cancel_tokens.lock().await;
        cancel_tokens.insert(project_id.to_string(), query_client.cancel_token());
    }
    {
        let mut client_ssl = app_state.client_ssl.lock().await;
        client_ssl.insert(project_id.to_string(), use_ssl);
    }

    Ok(ProjectConnectionStatus::Connected)
}

// ── Meta commands (use meta_clients) ─────────────────────────────────

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_rules(&client, schema, table).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_policies(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PolicyDetail>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_views(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_materialized_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

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
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_functions(&client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_trigger_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_trigger_functions(&client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_activity(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    let result = load_activity(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbStat>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_database_stats(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    let result = load_table_stats(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_foreign_keys(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<ForeignKeyInfo>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_foreign_keys(&client, schema).await.map_err(Into::into)
}

// ── Query commands (use clients) ─────────────────────────────────────

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
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let result = execute_query_packed(&client, sql).await?;
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
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let result =
        execute_virtual(&client, &app_state.virtual_cache, sql, query_id, page_size).await?;
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
    let result =
        fetch_virtual_page(&app_state.virtual_cache, query_id, col_count, offset, limit).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_close_virtual(query_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    close_virtual(&app_state.virtual_cache, query_id)
        .await
        .map_err(Into::into)
}
