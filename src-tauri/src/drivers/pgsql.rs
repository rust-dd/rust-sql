use std::{
    collections::BTreeMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use deadpool_postgres::{Manager as PgManager, ManagerConfig, Pool, RecyclingMethod};

use crate::AppState;
use crate::common::enums::{AppError, ProjectConnectionStatus};
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::drivers::common::{
    ColumnDetail, ConstraintDetail, DbGrant, DbStat, FKDetail, ForeignKeyInfo, FunctionInfo,
    IndexDetail, ObjectStats, PgRole, PolicyDetail, RuleDetail, SchemaObject, TableGrant,
    TriggerDetail, close_virtual, discover_notify_channels, execute_query, execute_query_packed,
    execute_query_streamed, execute_virtual, extract_schema_objects, fetch_virtual_page,
    generate_full_ddl, get_pool, import_csv_to_table, load_active_locks, load_activity,
    load_available_extensions, load_column_details, load_columns, load_constraints,
    load_database_grants, load_database_stats, load_databases, load_enum_types, load_extensions,
    load_fk_details, load_foreign_keys, load_function_info, load_functions, load_index_usage,
    load_indexes, load_materialized_views, load_matview_info, load_pg_settings, load_policies,
    load_roles, load_rules, load_schemas, load_table_bloat, load_table_grants,
    load_table_statistics, load_table_stats, load_tables, load_tablespaces, load_trigger_functions,
    load_triggers, load_view_info, load_views, parse_csv_preview,
};

use futures_util::StreamExt;
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tauri::ipc::Response;
use tauri::{AppHandle, Emitter, Manager, Result, State};
use tokio::time::{Duration, sleep};
use tokio_postgres::{AsyncMessage, CancelToken, Config, NoTls};

const CELL_SEP: char = '\x1F';
const SNAPSHOT_PAGE_WRITE_RETRIES: usize = 3;

fn is_sqlite_lock_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("database is locked") || lower.contains("database busy")
}

/// Walk the full std::error::Error source chain into a single string.
fn full_error_chain(e: &dyn std::error::Error) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(cause) = src {
        msg.push_str(": ");
        msg.push_str(&cause.to_string());
        src = cause.source();
    }
    msg
}

fn create_pg_pool(
    cfg: &Config,
    use_ssl: bool,
    max_size: usize,
) -> std::result::Result<Pool, AppError> {
    let manager_config = ManagerConfig {
        recycling_method: RecyclingMethod::Custom("ROLLBACK".into()),
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

async fn apply_statement_timeout(
    client: &deadpool_postgres::Client,
    timeout_ms: u32,
) {
    if timeout_ms > 0 {
        client
            .simple_query(&format!("SET statement_timeout = {}", timeout_ms))
            .await
            .ok();
    }
}

async fn reset_statement_timeout(
    client: &deadpool_postgres::Client,
    timeout_ms: u32,
) {
    if timeout_ms > 0 {
        client.simple_query("RESET statement_timeout").await.ok();
    }
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

#[derive(Clone)]
struct VirtualSnapshotMeta {
    project_id: String,
    sql: String,
    page_size: usize,
    col_count: usize,
}

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

async fn snapshot_upsert_metadata(
    app_state: &AppState,
    project_id: &str,
    query_id: &str,
    sql: &str,
    columns_packed: &str,
    total_rows: usize,
    page_size: usize,
    col_count: usize,
) -> std::result::Result<(), AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "INSERT OR REPLACE INTO virtual_query_snapshots (
            query_id, project_id, sql, columns_packed, total_rows, page_size, col_count, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        libsql::params![
            query_id,
            project_id,
            sql,
            columns_packed,
            total_rows as i64,
            page_size as i64,
            col_count as i64,
            now_unix_secs(),
        ],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

async fn snapshot_store_page(
    app_state: &AppState,
    query_id: &str,
    page_index: usize,
    packed_page: &str,
) -> std::result::Result<(), AppError> {
    if packed_page.is_empty() {
        return Ok(());
    }

    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    for attempt in 0..SNAPSHOT_PAGE_WRITE_RETRIES {
        match conn
            .execute(
                "INSERT OR IGNORE INTO virtual_query_pages (query_id, page_index, packed_page)
                 VALUES (?1, ?2, ?3)",
                libsql::params![query_id, page_index as i64, packed_page],
            )
            .await
        {
            Ok(_) => return Ok(()),
            Err(e) => {
                let msg = e.to_string();
                if is_sqlite_lock_error(&msg) {
                    if attempt + 1 < SNAPSHOT_PAGE_WRITE_RETRIES {
                        sleep(Duration::from_millis((attempt as u64 + 1) * 8)).await;
                        continue;
                    }
                    // Snapshot persistence is best-effort; skip noisy lock errors.
                    tracing::debug!(
                        "Skipping snapshot page persist for {} page {} due to SQLite lock",
                        query_id,
                        page_index
                    );
                    return Ok(());
                }
                return Err(AppError::DatabaseError(msg));
            }
        }
    }

    Ok(())
}

async fn snapshot_load_page(
    app_state: &AppState,
    query_id: &str,
    page_index: usize,
) -> std::result::Result<Option<String>, AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT packed_page
             FROM virtual_query_pages
             WHERE query_id = ?1 AND page_index = ?2
             LIMIT 1",
            libsql::params![query_id, page_index as i64],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let maybe_row = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    if let Some(row) = maybe_row {
        let packed: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(Some(packed))
    } else {
        Ok(None)
    }
}

async fn snapshot_load_metadata(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<Option<VirtualSnapshotMeta>, AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT project_id, sql, page_size, col_count
             FROM virtual_query_snapshots
             WHERE query_id = ?1
             LIMIT 1",
            libsql::params![query_id],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let maybe_row = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let Some(row) = maybe_row else {
        return Ok(None);
    };

    let project_id: String = row
        .get(0)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let sql: String = row
        .get(1)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let page_size_i64: i64 = row
        .get(2)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let col_count_i64: i64 = row
        .get(3)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    if page_size_i64 <= 0 {
        return Ok(None);
    }

    Ok(Some(VirtualSnapshotMeta {
        project_id,
        sql,
        page_size: page_size_i64 as usize,
        col_count: col_count_i64.max(0) as usize,
    }))
}

async fn snapshot_cleanup_query(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<(), AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_pages WHERE query_id = ?1",
        libsql::params![query_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_snapshots WHERE query_id = ?1",
        libsql::params![query_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

async fn restore_virtual_from_snapshot(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<bool, AppError> {
    let Some(meta) = snapshot_load_metadata(app_state, query_id).await? else {
        return Ok(false);
    };

    let client = acquire_client(&app_state.clients, &meta.project_id).await?;
    set_cancel_token(app_state, &meta.project_id, client.cancel_token()).await?;

    let (columns_packed, total_rows, first_page_packed, _) = execute_virtual(
        &client,
        &app_state.virtual_cache,
        &meta.sql,
        query_id,
        meta.page_size,
    )
    .await?;

    if columns_packed.is_empty() {
        return Ok(false);
    }

    let col_count = if meta.col_count > 0 {
        meta.col_count
    } else {
        columns_packed.split(CELL_SEP).count()
    };

    if let Err(e) = snapshot_upsert_metadata(
        app_state,
        &meta.project_id,
        query_id,
        &meta.sql,
        &columns_packed,
        total_rows,
        meta.page_size,
        col_count,
    )
    .await
    {
        tracing::warn!(
            "Failed to refresh snapshot metadata for {}: {:?}",
            query_id,
            e
        );
    }
    if let Err(e) = snapshot_store_page(app_state, query_id, 0, &first_page_packed).await {
        tracing::warn!(
            "Failed to refresh snapshot first page for {}: {:?}",
            query_id,
            e
        );
    }

    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_test_connection(
    key: [&str; 6],
) -> Result<String> {
    let user = key[0];
    let password = key[1];
    let database = key[2];
    let host = key[3];
    let port: u16 = key[4].parse().unwrap_or(5432);
    let use_ssl = key[5] == "true";

    let mut cfg = Config::new();
    cfg.user(user)
        .password(password)
        .dbname(database)
        .host(host)
        .port(port);

    let pool = create_pg_pool(&cfg, use_ssl, 1)?;
    let client = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionFailed(full_error_chain(&e)))?;

    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;

    let version: String = row.get(0);
    Ok(version)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_connector(
    project_id: &str,
    key: Option<[&str; 6]>,
    ssh: Option<Vec<String>>,
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

    // Determine effective host/port, potentially through an SSH tunnel
    let (effective_host, effective_port_str) = if let Some(ref ssh_params) = ssh {
        // ssh_params: [ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_path]
        if ssh_params.len() >= 3 && !ssh_params[0].is_empty() {
            let ssh_host = &ssh_params[0];
            let ssh_port: u16 = ssh_params[1].parse().unwrap_or(22);
            let ssh_user = &ssh_params[2];
            let ssh_password = ssh_params
                .get(3)
                .filter(|s| !s.is_empty())
                .map(|s| s.as_str());
            let ssh_key_path = ssh_params
                .get(4)
                .filter(|s| !s.is_empty())
                .map(|s| s.as_str());

            // Stop any existing tunnel for this project
            app_state.ssh_tunnels.lock().await.remove(project_id);

            let tunnel = crate::ssh::start_tunnel(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key_path,
                &host,
                port_str.parse().unwrap_or(5432),
            )
            .await
            .map_err(|e| AppError::ConnectionFailed(e))?;

            let local_port = tunnel.local_port;
            app_state
                .ssh_tunnels
                .lock()
                .await
                .insert(project_id.to_string(), tunnel);

            ("127.0.0.1".to_string(), local_port.to_string())
        } else {
            (host.clone(), port_str.clone())
        }
    } else {
        (host.clone(), port_str.clone())
    };

    let port: u16 = effective_port_str.parse().unwrap_or(5432);
    let mut cfg = Config::new();
    cfg.user(&user)
        .password(&password)
        .dbname(&database)
        .host(&effective_host)
        .port(port);

    // Create two pools: one for user queries, one for metadata.
    let query_pool = match create_pg_pool(&cfg, use_ssl, 16) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Query pool creation failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)).into());
        }
    };
    let meta_pool = match create_pg_pool(&cfg, use_ssl, 8) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Meta pool creation failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)).into());
        }
    };

    // Validate connectivity eagerly so connector keeps previous fail/connected behavior.
    let query_client = match query_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Query pool initial connection failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)).into());
        }
    };
    if let Err(e) = meta_pool.get().await {
        tracing::error!("Meta pool initial connection failed: {:?}", e);
        return Err(AppError::ConnectionFailed(full_error_chain(&e)).into());
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

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_databases(project_id: &str, app: AppHandle) -> Result<Vec<String>> {
    let app_state = app.state::<AppState>();
    let pool = {
        let pools = app_state.meta_clients.lock().await;
        get_pool(&pools, project_id)?
    };

    load_databases(&pool).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_tablespaces(
    project_id: &str,
    app: AppHandle,
) -> Result<Vec<(String, String, String)>> {
    let app_state = app.state::<AppState>();
    let pool = {
        let pools = app_state.meta_clients.lock().await;
        get_pool(&pools, project_id)?
    };

    load_tablespaces(&pool).await.map_err(Into::into)
}

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

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_table_statistics(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<ObjectStats> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_statistics(&client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_fk_details(
    project_id: &str,
    schema: &str,
    table: &str,
    direction: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FKDetail>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_fk_details(&client, schema, table, direction)
        .await
        .map_err(Into::into)
}

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

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_preview(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>)> {
    parse_csv_preview(file_path, 5).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_import(
    project_id: &str,
    file_path: &str,
    schema: &str,
    table: &str,
    column_mapping: Vec<(usize, String)>,
    app_state: State<'_, AppState>,
) -> Result<usize> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    import_csv_to_table(&client, file_path, schema, table, &column_mapping)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_listen_start(project_id: &str, channel: &str, app: AppHandle) -> Result<bool> {
    let app_handle = app.clone();
    let app_state = app_handle.state::<AppState>();
    let listen_key = format!("{}:{}", project_id, channel);

    {
        let handles = app_state.notify_handles.lock().await;
        if handles.contains_key(&listen_key) {
            return Ok(true); // Already listening
        }
    }

    // Get connection config from local db
    let (cfg, use_ssl) = {
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

        let mut cfg = Config::new();
        cfg.user(&row.get::<String>(0).unwrap_or_default())
            .password(&row.get::<String>(1).unwrap_or_default())
            .dbname(&row.get::<String>(2).unwrap_or_default())
            .host(&row.get::<String>(3).unwrap_or_default())
            .port(
                row.get::<String>(4)
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or(5432),
            );
        let ssl = row.get::<String>(5).map(|s| s == "true").unwrap_or(false);
        (cfg, ssl)
    };

    let channel_owned = channel.to_string();
    let event_name = format!("pg-notify-{}", project_id);

    let handle = tokio::spawn(async move {
        // Helper: drive a connection, forwarding notifications as Tauri events
        async fn listen_loop<S, T>(
            client: tokio_postgres::Client,
            mut connection: tokio_postgres::Connection<S, T>,
            channel: &str,
            event_name: &str,
            app: &AppHandle,
        ) where
            S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
            T: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
        {
            let listen_sql = format!("LISTEN \"{}\"", channel.replace('"', "\"\""));
            if let Err(e) = client.batch_execute(&listen_sql).await {
                tracing::error!("LISTEN command failed: {:?}", e);
                return;
            }
            tracing::info!("LISTEN started on channel: {}", channel);

            let mut stream = futures_util::stream::poll_fn(move |cx| connection.poll_message(cx));

            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(AsyncMessage::Notification(n)) => {
                        let payload = serde_json::json!({
                            "channel": n.channel(),
                            "payload": n.payload(),
                        });
                        let _ = app.emit(event_name, payload);
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!("LISTEN stream error: {:?}", e);
                        break;
                    }
                }
            }
            tracing::info!("LISTEN ended on channel: {}", channel);
            drop(client);
        }

        if use_ssl {
            let tls_connector = match TlsConnector::builder().build() {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("LISTEN TLS error: {:?}", e);
                    return;
                }
            };
            let tls = MakeTlsConnector::new(tls_connector);
            match cfg.connect(tls).await {
                Ok((client, connection)) => {
                    listen_loop(client, connection, &channel_owned, &event_name, &app).await;
                }
                Err(e) => tracing::error!("LISTEN connect error: {:?}", e),
            }
        } else {
            match cfg.connect(NoTls).await {
                Ok((client, connection)) => {
                    listen_loop(client, connection, &channel_owned, &event_name, &app).await;
                }
                Err(e) => tracing::error!("LISTEN connect error: {:?}", e),
            }
        }
    });

    {
        let mut handles = app_state.notify_handles.lock().await;
        handles.insert(listen_key, handle);
    }

    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_listen_stop(project_id: &str, channel: &str, app: AppHandle) -> Result<bool> {
    let app_state = app.state::<AppState>();
    let listen_key = format!("{}:{}", project_id, channel);

    let mut handles = app_state.notify_handles.lock().await;
    if let Some(handle) = handles.remove(&listen_key) {
        handle.abort();
    }

    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_notify_send(
    project_id: &str,
    channel: &str,
    payload: &str,
    app_state: State<'_, AppState>,
) -> Result<bool> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    let sql = format!(
        "SELECT pg_notify('{}', '{}')",
        channel.replace('\'', "''"),
        payload.replace('\'', "''"),
    );
    client
        .batch_execute(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(true)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_discover_channels(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    discover_notify_channels(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_roles(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PgRole>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_roles(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<TableGrant>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_grants(&client, role_name)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbGrant>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_database_grants(&client, role_name)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_extract_schema_objects(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<SchemaObject>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    extract_schema_objects(&client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_locks(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_active_locks(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_index_usage(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_index_usage(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_bloat(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_table_bloat(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_extensions(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_available_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_available_extensions(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_enum_types(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_enum_types(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
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
) -> Result<String> {
    let client = acquire_client(&app_state.clients, project_id).await?;

    // Quote identifiers safely
    fn qi(name: &str) -> String {
        format!("\"{}\"", name.replace('"', "\"\""))
    }

    let qualified = format!("{}.{}", qi(schema), qi(table));

    let sql = match (object_type, action) {
        // Table actions
        ("table", "ANALYZE") => format!("ANALYZE {qualified}"),
        ("table", "VACUUM") => format!("VACUUM {qualified}"),
        ("table", "VACUUM FULL") => format!("VACUUM FULL {qualified}"),
        ("table", "REINDEX") => format!("REINDEX TABLE {qualified}"),
        ("table", "TRUNCATE") => format!("TRUNCATE TABLE {qualified}"),
        ("table", "DROP TABLE") => format!("DROP TABLE {qualified}"),
        // View actions
        ("view", "DROP VIEW") => format!("DROP VIEW {qualified}"),
        ("view", "DROP VIEW CASCADE") => format!("DROP VIEW {qualified} CASCADE"),
        // Materialized view actions
        ("matview", "REFRESH") => format!("REFRESH MATERIALIZED VIEW {qualified}"),
        ("matview", "REFRESH CONCURRENTLY") => {
            format!("REFRESH MATERIALIZED VIEW CONCURRENTLY {qualified}")
        }
        ("matview", "DROP MATERIALIZED VIEW") => format!("DROP MATERIALIZED VIEW {qualified}"),
        // Function actions
        ("function" | "trigger-function", "DROP FUNCTION") => format!("DROP FUNCTION {qualified}"),
        ("function" | "trigger-function", "DROP FUNCTION CASCADE") => {
            format!("DROP FUNCTION {qualified} CASCADE")
        }
        _ => {
            return Err(AppError::QueryFailed(format!(
                "Unknown action '{}' for object type '{}'",
                action, object_type
            ))
            .into());
        }
    };

    execute_query(&client, &sql).await.map_err(|e| e)?;

    Ok(format!("{action} completed successfully."))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_pg_settings(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_pg_settings(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}
