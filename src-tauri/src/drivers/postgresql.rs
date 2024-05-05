use std::time::Instant;

use common::projects::postgresql::PostgresqlRelation;
use tauri::{AppHandle, Manager, Result, State};
use tokio_postgres::{connect, NoTls};

use crate::{utils::reflective_get, AppState};

#[tauri::command(rename_all = "snake_case")]
pub async fn postgresql_connector(
  project_name: &str,
  key: &str,
  app: AppHandle,
) -> Result<Vec<String>> {
  let app_state = app.state::<AppState>();
  let (client, connection) = connect(key, NoTls).await.expect("connection error");
  tokio::spawn(async move {
    if let Err(e) = connection.await {
      eprintln!("connection error: {}", e);
    }
  });

  let schemas = client
    .query(
      r#"
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema');
        "#,
      &[],
    )
    .await
    .unwrap();
  let schemas = schemas.iter().map(|r| r.get(0)).collect();
  let mut clients = app_state.client.lock().await;
  let clients = clients.as_mut().unwrap();
  clients.insert(project_name.to_string(), client);
  Ok(schemas)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn select_schema_tables(
  project_name: &str,
  schema: &str,
  app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>> {
  let clients = app_state.client.lock().await;
  let client = clients.as_ref().unwrap().get(project_name).unwrap();
  let tables = client
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
  let tables = tables
    .iter()
    .map(|r| (r.get(0), r.get(1)))
    .collect::<Vec<(String, String)>>();
  Ok(tables)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn select_sql_result(
  project_name: &str,
  sql: String,
  app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32)> {
  let start = Instant::now();
  let clients = app_state.client.lock().await;
  let client = clients.as_ref().unwrap().get(project_name).unwrap();
  let rows = client.query(sql.as_str(), &[]).await.unwrap();

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
pub async fn select_schema_relations(
  project_name: &str,
  schema: &str,
  app_state: State<'_, AppState>,
) -> Result<Vec<PostgresqlRelation>> {
  let clients = app_state.client.lock().await;
  let client = clients.as_ref().unwrap().get(project_name).unwrap();
  let rows = client
    .query(
      r#"--sql SELECT 
          tc.constraint_name, 
          tc.table_name,
          kcu.column_name, 
          ccu.table_name AS foreign_table_name, 
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1;
      "#,
      &[&schema],
    )
    .await
    .unwrap();

  let relations = rows
    .iter()
    .map(|row| {
      let constraint_name = row.get(0);
      let table_name = row.get(1);
      let column_name = row.get(2);
      let foreign_table_name = row.get(3);
      let foreign_column_name = row.get(4);
      PostgresqlRelation {
        constraint_name,
        table_name,
        column_name,
        foreign_table_name,
        foreign_column_name,
      }
    })
    .collect::<Vec<PostgresqlRelation>>();

  Ok(relations)
}

