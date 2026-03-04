use std::sync::Arc;

use crate::common::enums::{AppError, ProjectConnectionStatus};
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::drivers::common::{
    execute_query, get_client, load_activity, load_column_details, load_columns, load_constraints,
    load_database_stats, load_functions, load_indexes, load_materialized_views, load_policies,
    load_rules, load_schemas, load_table_stats, load_tables, load_trigger_functions, load_triggers,
    load_views, ColumnDetail, ConstraintDetail, DbStat, FunctionInfo, IndexDetail, PolicyDetail,
    RuleDetail, TriggerDetail,
};
use crate::AppState;

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
    let mut clients = app_state.client.lock().await;
    let client_map = clients
        .as_mut()
        .ok_or(AppError::DatabaseError("No client map".into()))?;

    if client_map.contains_key(project_id) {
        return Ok(ProjectConnectionStatus::Connected);
    }

    let (user, password, database, host, port_str, _use_ssl) = match key {
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

    let connection = tokio_time::timeout(tokio_time::Duration::from_secs(10), cfg.connect(NoTls))
        .await
        .map_err(|_| AppError::ConnectionTimeout);

    let (client, connection) = match connection {
        Ok(Ok(pair)) => pair,
        Ok(Err(e)) => {
            tracing::error!("Postgres connection error: {:?}", e);
            return Ok(ProjectConnectionStatus::Failed);
        }
        Err(_) => {
            tracing::error!("Postgres connection timeout");
            return Ok(ProjectConnectionStatus::Failed);
        }
    };

    let is_connection_error = Arc::new(Mutex::new(false));
    tokio::spawn({
        let flag = Arc::clone(&is_connection_error);
        async move {
            if let Err(e) = connection.await {
                tracing::error!("Postgres connection error: {:?}", e);
                *flag.lock().await = true;
            }
        }
    });

    if *is_connection_error.lock().await {
        return Ok(ProjectConnectionStatus::Failed);
    }

    client_map.insert(project_id.to_string(), client);
    Ok(ProjectConnectionStatus::Connected)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_schemas(
        client,
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_tables(
        client,
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_columns(client, schema, table)
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_column_details(client, schema, table)
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_indexes(client, schema, table)
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_constraints(client, schema, table)
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_triggers(client, schema, table)
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
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_rules(client, schema, table).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_policies(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PolicyDetail>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_policies(client, schema, table)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_views(client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_materialized_views(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_materialized_views(client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<FunctionInfo>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_functions(client, schema).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_trigger_functions(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_trigger_functions(client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_run_query(
    project_id: &str,
    sql: &str,
    app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32)> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    execute_query(client, sql).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_activity(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<Vec<String>>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_activity(client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbStat>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_database_stats(client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_stats(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<Vec<String>>> {
    let clients = app_state.client.lock().await;
    let client_map = clients
        .as_ref()
        .ok_or(AppError::DatabaseError("No client map".into()))?;
    let client = get_client(client_map, project_id)?;

    load_table_stats(client).await.map_err(Into::into)
}
