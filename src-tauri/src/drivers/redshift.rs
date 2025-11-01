use std::{sync::Arc, time::Instant};

use crate::common::{
    enums::{PostgresqlError, ProjectConnectionStatus},
    pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables},
};
use tauri::{AppHandle, Manager, Result, State};
use tokio::{sync::Mutex, time as tokio_time};
use tokio_postgres::Config;
use postgres_native_tls::MakeTlsConnector;
use native_tls::TlsConnector;

use crate::{utils::reflective_get, AppState};

#[tauri::command(rename_all = "snake_case")]
pub async fn redshift_connector(
    project_id: &str,
    key: Option<[&str; 6]>,
    app: AppHandle,
) -> Result<ProjectConnectionStatus> {
    let app_state = app.state::<AppState>();
    let mut clients = app_state.client.lock().await;
    tracing::info!("Redshift connection attempt: {:?}", key);
    
    // check if connection already exists
    if clients.as_ref().unwrap().contains_key(project_id) {
        tracing::info!("Redshift connection already exists!");
        return Ok(ProjectConnectionStatus::Connected);
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
            let projects_db = app_state.project_db.lock().await;
            let projects_db = projects_db.as_ref().unwrap();
            let project_details = projects_db.get(project_id).unwrap();
            let project_details = match project_details {
                Some(bytes) => bincode::deserialize::<Vec<String>>(&bytes).unwrap(),
                _ => Vec::new(),
            };
            (
                project_details[1].clone(),
                project_details[2].clone(),
                project_details[3].clone(),
                project_details[4].clone(),
                project_details[5].clone(),
                project_details.get(6).map(|s| s == "true").unwrap_or(false),
            )
        }
    };

    let port: u16 = port_str.parse::<u16>().unwrap_or(5439); // Redshift default port
    let mut cfg = Config::new();
    cfg.user(&user);
    cfg.password(password);
    cfg.dbname(&database);
    cfg.host(&host);
    cfg.port(port);

    tracing::info!("Redshift SSL enabled: {}", use_ssl);

    // Redshift always uses SSL in production, but allow NoTls for testing
    let tls_connector = TlsConnector::builder()
        .danger_accept_invalid_certs(true) // Accept self-signed certs
        .build()
        .unwrap();
    let tls = MakeTlsConnector::new(tls_connector);
    
    let connection = tokio_time::timeout(tokio_time::Duration::from_secs(10), cfg.connect(tls))
        .await
        .map_err(|_| PostgresqlError::ConnectionTimeout);

    if let Err(e) = connection {
        tracing::error!("Redshift connection timeout error: {:?}", e);
        return Ok(ProjectConnectionStatus::Failed);
    }

    let connection = connection.unwrap();
    if let Err(e) = connection {
        tracing::error!("Redshift connection error: {:?}", e);
        return Ok(ProjectConnectionStatus::Failed);
    }

    let is_connection_error = Arc::new(Mutex::new(false));
    let (client, connection) = connection.unwrap();
    tracing::info!("Redshift connection established!");

    // check if connection has some error
    tokio::spawn({
        let is_connection_error = Arc::clone(&is_connection_error);
        async move {
            if let Err(e) = connection.await {
                tracing::info!("Redshift connection error: {:?}", e);
                *is_connection_error.lock().await = true;
            }
        }   
    });

    if *is_connection_error.lock().await {
        tracing::error!("Redshift connection error!");
        return Ok(ProjectConnectionStatus::Failed);
    }

    let clients = clients.as_mut().unwrap();
    clients.insert(project_id.to_string(), client);

    Ok(ProjectConnectionStatus::Connected)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn redshift_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas> {
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();

    // Redshift uses similar schema query but with some differences
    let query = tokio_time::timeout(
        tokio_time::Duration::from_secs(10),
        client.query(
            r#"
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_internal')
        ORDER BY schema_name;
        "#,
            &[],
        ),
    )
    .await
    .map_err(|_| PostgresqlError::QueryTimeout);

    if query.is_err() {
        tracing::error!("Redshift schema query timeout error!");
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            PostgresqlError::QueryTimeout,
        )));
    }

    let query = query.unwrap();
    if query.is_err() {
        tracing::error!("Redshift schema query error!");
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            PostgresqlError::QueryError,
        )));
    }

    let qeury = query.unwrap();
    let schemas = qeury.iter().map(|r| r.get(0)).collect::<Vec<String>>();
    tracing::info!("Redshift schemas: {:?}", schemas);
    Ok(schemas)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn redshift_load_tables(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadTables> {
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();
    
    // Use information_schema which is more universally accessible
    let query = client
    .query(
      r#"--sql
        SELECT 
          table_name,
          '-' AS size
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        "#,
      &[&schema],
    )
    .await;

    
    if let Err(e) = query {
        tracing::error!("Redshift load tables error: {:?}", e);
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to load tables: {:?}", e),
        )));
    }
    
    let rows = query.unwrap();
    let tables = rows
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect::<Vec<(String, String)>>();
    Ok(tables)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn redshift_load_columns(
    project_id: &str,
    schema: &str,
    table: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadColumns> {
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();
    let rows = client
        .query(
            r#"--sql
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
        "#,
            &[&schema, &table],
        )
        .await
        .unwrap();
    let cols = rows
        .iter()
        .map(|r| r.get::<_, String>(0))
        .collect::<Vec<String>>();
    Ok(cols)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn redshift_run_query(
    project_id: &str,
    sql: &str,
    app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32)> {
    let start = Instant::now();
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();
    let rows = client.query(sql, &[]).await.unwrap();

    if rows.is_empty() {
        return Ok((Vec::new(), Vec::new(), 0.0f32));
    }

    let columns = rows
        .first()
        .unwrap()
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect::<Vec<String>>();
    let rows = rows
        .iter()
        .map(|row| {
            let mut row_values = Vec::new();
            for i in 0..row.len() {
                let value = reflective_get(row, i);
                row_values.push(value);
            }
            row_values
        })
        .collect::<Vec<Vec<String>>>();
    let elasped = start.elapsed().as_millis() as f32;
    Ok((columns, rows, elasped))
}

