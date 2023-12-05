use sqlx::{postgres::PgPoolOptions, Column, Row};
use tauri::{Result, State};

use crate::AppState;

#[tauri::command]
pub async fn pg_connector(key: &str, app_state: State<'_, AppState>) -> Result<Vec<String>> {
    if key.is_empty() {
        return Ok(Vec::new());
    }

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(key)
        .await
        .unwrap();

    let schemas: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT schema_name
        FROM information_schema.schemata;
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    let schemas = schemas.iter().map(|r| r.0.clone()).collect();

    *app_state.connection_strings.lock().await = key.to_string();
    *app_state.pool.lock().await = Some(pool);

    Ok(schemas)
}

#[tauri::command]
pub async fn get_schema_tables(
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>> {
    let pool = app_state.pool.lock().await;
    let tables: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        "#,
    )
    .bind(schema)
    .fetch_all(pool.as_ref().unwrap())
    .await
    .unwrap();
    let tables = tables.iter().map(|r| r.0.clone()).collect();

    Ok(tables)
}

#[tauri::command]
pub async fn get_sql_result(
    sql: String,
    app_state: State<'_, AppState>,
) -> Result<(Vec<String>, Vec<Vec<String>>)> {
    let pool = app_state.pool.lock().await;

    let query = sqlx::query(&sql)
        .fetch_all(pool.as_ref().unwrap())
        .await
        .unwrap();
    // get columns
    let columns = query
        .get(0)
        .unwrap()
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect::<Vec<String>>();
    // get rows
    let rows = query
        .iter()
        .map(|r| {
            let mut row = Vec::new();
            for i in 0..r.len() {
                let value = r.try_get::<String, _>(i).unwrap_or(String::from("null"));
                row.push(value);
            }
            row
        })
        .collect::<Vec<Vec<String>>>();

    Ok((columns, rows))
}

