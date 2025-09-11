use std::{sync::Arc, time::Instant};

use crate::common::{
    enums::{PostgresqlError, ProjectConnectionStatus},
    pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables},
};
use tauri::{AppHandle, Manager, Result, State};
use tokio::{sync::Mutex, time as tokio_time};
use tokio_postgres::{Config, NoTls};

use crate::{utils::reflective_get, AppState};

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_connector(
    project_id: &str,
    key: Option<[&str; 5]>,
    app: AppHandle,
) -> Result<ProjectConnectionStatus> {
    let app_state = app.state::<AppState>();
    let mut clients = app_state.client.lock().await;
    tracing::info!("Postgres connection already exists!: {:?}", key);
    // check if connection already exists
    if clients.as_ref().unwrap().contains_key(project_id) {
        tracing::info!("Postgres connection already exists!");
        return Ok(ProjectConnectionStatus::Connected);
    }

    let (user, password, database, host, port_str) = match key {
        Some(key) => (
            key[0].to_string(),
            key[1].to_string(),
            key[2].to_string(),
            key[3].to_string(),
            key[4].to_string(),
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
            )
        }
    };

    let port: u16 = port_str.parse::<u16>().unwrap_or(5432);
    let mut cfg = Config::new();
    cfg.user(&user);
    cfg.password(password);
    cfg.dbname(&database);
    cfg.host(&host);
    cfg.port(port);

    let connection = tokio_time::timeout(tokio_time::Duration::from_secs(10), cfg.connect(NoTls))
        .await
        .map_err(|_| PostgresqlError::ConnectionTimeout);

    if connection.is_err() {
        tracing::error!("Postgres connection timeout error!");
        return Ok(ProjectConnectionStatus::Failed);
    }

    let connection = connection.unwrap();
    if connection.is_err() {
        tracing::error!("Postgres connection error!");
        return Ok(ProjectConnectionStatus::Failed);
    }

    let is_connection_error = Arc::new(Mutex::new(false));
    let (client, connection) = connection.unwrap();
    tracing::info!("Postgres connection established!");

    // check if connection has some error
    tokio::spawn({
        let is_connection_error = Arc::clone(&is_connection_error);
        async move {
            if let Err(e) = connection.await {
                tracing::info!("Postgres connection error: {:?}", e);
                *is_connection_error.lock().await = true;
            }
        }
    });

    if *is_connection_error.lock().await {
        tracing::error!("Postgres connection error!");
        return Ok(ProjectConnectionStatus::Failed);
    }

    let clients = clients.as_mut().unwrap();
    clients.insert(project_id.to_string(), client);

    Ok(ProjectConnectionStatus::Connected)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_schemas(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadSchemas> {
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();

    let query = tokio_time::timeout(
        tokio_time::Duration::from_secs(10),
        client.query(
            r#"
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schema_name;
        "#,
            &[],
        ),
    )
    .await
    .map_err(|_| PostgresqlError::QueryTimeout);

    if query.is_err() {
        tracing::error!("Postgres schema query timeout error!");
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            PostgresqlError::QueryTimeout,
        )));
    }

    let query = query.unwrap();
    if query.is_err() {
        tracing::error!("Postgres schema query error!");
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            PostgresqlError::QueryError,
        )));
    }

    let qeury = query.unwrap();
    let schemas = qeury.iter().map(|r| r.get(0)).collect::<Vec<String>>();
    tracing::info!("Postgres schemas: {:?}", schemas);
    Ok(schemas)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_tables(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<PgsqlLoadTables> {
    let clients = app_state.client.lock().await;
    let client = clients.as_ref().unwrap().get(project_id).unwrap();
    let query = client
    .query(
      r#"--sql
        SELECT
          table_name,
          pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS size
        FROM
          information_schema.tables
        WHERE
          table_schema = $1
        ORDER BY
          table_name;
        "#,
      &[&schema],
    )
    .await
    .unwrap();
    let tables = query
        .iter()
        .map(|r| (r.get(0), r.get(1)))
        .collect::<Vec<(String, String)>>();
    Ok(tables)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_columns(
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
pub async fn pgsql_run_query(
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

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_relations(
    project_name: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<()>> {
    // let clients = app_state.client.lock().await;
    // let client = clients.as_ref().unwrap().get(project_name).unwrap();
    // let rows = client
    //   .query(
    //     r#"--sql SELECT
    //         tc.constraint_name,
    //         tc.table_name,
    //         kcu.column_name,
    //         ccu.table_name AS foreign_table_name,
    //         ccu.column_name AS foreign_column_name
    //       FROM information_schema.table_constraints AS tc
    //       JOIN information_schema.key_column_usage AS kcu
    //       ON tc.constraint_name = kcu.constraint_name
    //       JOIN information_schema.constraint_column_usage AS ccu
    //       ON ccu.constraint_name = tc.constraint_name
    //       WHERE constraint_type = 'FOREIGN KEY'
    //       AND tc.table_schema = $1;
    //     "#,
    //     &[&schema],
    //   )
    //   .await
    //   .unwrap();

    // let relations = rows
    //   .iter()
    //   .map(|row| {
    //     let constraint_name = row.get(0);
    //     let table_name = row.get(1);
    //     let column_name = row.get(2);
    //     let foreign_table_name = row.get(3);
    //     let foreign_column_name = row.get(4);
    //     PostgresqlRelation {
    //       constraint_name,
    //       table_name,
    //       column_name,
    //       foreign_table_name,
    //       foreign_column_name,
    //     }
    //   })
    //   .collect::<Vec<PostgresqlRelation>>();

    // Ok(relations)
    todo!()
}
