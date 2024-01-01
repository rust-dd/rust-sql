use tauri::{AppHandle, Manager, Result, State};
use tokio_postgres::{connect, NoTls};

use crate::{utils::reflective_get, AppState};

#[tauri::command]
pub async fn pg_connector(project: &str, key: &str, app: AppHandle) -> Result<Vec<String>> {
  let app_state = app.state::<AppState>();
  let mut db = app_state.project_db.lock().await;
  if let Some(ref mut db_instance) = *db {
    db_instance.insert(project, key).unwrap();
  }

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
  clients.insert(project.to_string(), client);

  Ok(schemas)
}

#[tauri::command]
pub async fn select_schema_tables(
  project: &str,
  schema: &str,
  app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>> {
  let clients = app_state.client.lock().await;
  let client = clients.as_ref().unwrap().get(project).unwrap();
  let tables = client
    .query(
      r#"
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

#[tauri::command]
pub async fn select_sql_result(
  project: &str,
  sql: String,
  app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>)> {
  let clients = app_state.client.lock().await;
  let client = clients.as_ref().unwrap().get(project).unwrap();
  let rows = client.query(sql.as_str(), &[]).await.unwrap();

  if rows.is_empty() {
    return Ok((Vec::new(), Vec::new()));
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

  Ok((columns, rows))
}
