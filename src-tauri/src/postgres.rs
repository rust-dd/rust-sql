use tauri::{AppHandle, Manager, Result, State};
use tokio_postgres::{connect, NoTls};

use crate::{constant::PROJECT_DB_PATH, utils::reflective_get, AppState};

#[tauri::command]
pub async fn pg_connector(project: &str, key: &str, app: AppHandle) -> Result<Vec<String>> {
  let app_state = app.state::<AppState>();
  let mut db = app_state.project_db.lock().await;
  if db.clone().is_none() {
    let app_dir = app.path_resolver().app_data_dir().unwrap();
    let db_path = app_dir.join(PROJECT_DB_PATH);
    let _db = sled::open(db_path).unwrap();
    *db = Some(_db);
  }
  db.clone().unwrap().insert(project, key).unwrap();

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
        FROM information_schema.schemata;
        "#,
      &[],
    )
    .await
    .unwrap();
  let schemas = schemas.iter().map(|r| r.get(0)).collect();

  *app_state.connection_strings.lock().await = key.to_string();
  *app_state.client.lock().await = Some(client);

  Ok(schemas)
}

#[tauri::command]
pub async fn get_schema_tables(
  schema: &str,
  app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
  let client = app_state.client.lock().await;
  let client = client.as_ref().unwrap();
  let tables = client
    .query(
      r#"
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        "#,
      &[&schema],
    )
    .await
    .unwrap();
  let tables = tables.iter().map(|r| r.get(0)).collect();

  Ok(tables)
}

#[tauri::command]
pub async fn get_sql_result(
  sql: String,
  app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>)> {
  let client = app_state.client.lock().await;
  let client = client.as_ref().unwrap();

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

