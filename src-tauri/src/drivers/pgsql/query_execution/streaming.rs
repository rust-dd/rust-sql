use std::time::Instant;
use tokio_postgres::{Client, SimpleQueryMessage};

use crate::common::enums::AppError;

use super::super::CELL_SEP;
use super::helpers::{join_sep, pack_rows_vec, process_simple_messages};

/// Events emitted during streamed query execution.
#[derive(serde::Serialize, Clone)]
#[serde(tag = "type")]
pub enum QueryStreamEvent {
    #[serde(rename = "columns")]
    Columns { columns: String, total_rows: usize },
    #[serde(rename = "chunk")]
    Chunk { data: String },
    #[serde(rename = "done")]
    Done { elapsed: f32, capped: bool },
}

/// Maximum rows to send to the frontend to prevent OOM in the webview.
const MAX_STREAM_ROWS: usize = 500_000;
const CURSOR_FETCH_SIZE: usize = 10_000;

/// Stream query results using a PostgreSQL cursor.
/// Fetches rows in batches from the server — never loads the full result into Rust memory.
/// Caps at MAX_STREAM_ROWS to protect the webview from OOM.
pub async fn execute_query_streamed(
    client: &Client,
    sql: &str,
    stream_id: &str,
    app: &tauri::AppHandle,
) -> Result<(), AppError> {
    use tauri::Emitter;

    let start = Instant::now();
    let event_name = format!("query-stream-{}", stream_id);

    // Begin transaction + declare cursor for memory-efficient streaming
    client
        .batch_execute("BEGIN")
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let cursor_sql = format!("DECLARE _rsql_cur NO SCROLL CURSOR FOR {}", sql);
    match client.batch_execute(&cursor_sql).await {
        Ok(_) => {
            // Cursor-based fetch loop using simple_query for zero type conversion
            let fetch_sql = format!("FETCH {} FROM _rsql_cur", CURSOR_FETCH_SIZE);
            let mut total_sent: usize = 0;
            let mut columns_sent = false;
            let mut capped = false;

            loop {
                let messages = match client.simple_query(&fetch_sql).await {
                    Ok(msgs) => msgs,
                    Err(e) => {
                        let _ = client.batch_execute("CLOSE _rsql_cur; ROLLBACK").await;
                        return Err(AppError::QueryFailed(e.to_string()));
                    }
                };

                let mut batch_rows: Vec<Vec<String>> = Vec::new();
                let mut batch_columns: Option<Vec<String>> = None;

                for msg in messages {
                    if let SimpleQueryMessage::Row(row) = msg {
                        let col_count = row.columns().len();
                        if batch_columns.is_none() {
                            let mut cols = Vec::with_capacity(col_count);
                            for c in row.columns() {
                                cols.push(c.name().to_owned());
                            }
                            batch_columns = Some(cols);
                        }
                        let mut cells = Vec::with_capacity(col_count);
                        for i in 0..col_count {
                            cells.push(row.get(i).unwrap_or("null").to_owned());
                        }
                        batch_rows.push(cells);
                    }
                }

                if batch_rows.is_empty() {
                    break;
                }

                if !columns_sent && let Some(cols) = batch_columns {
                    let header = join_sep(&cols, CELL_SEP);
                    let _ = app.emit(
                        &event_name,
                        QueryStreamEvent::Columns {
                            columns: header,
                            total_rows: 0,
                        },
                    );
                    columns_sent = true;
                }

                let packed = pack_rows_vec(&batch_rows);
                let _ = app.emit(&event_name, QueryStreamEvent::Chunk { data: packed });

                total_sent += batch_rows.len();
                if total_sent >= MAX_STREAM_ROWS {
                    capped = true;
                    break;
                }
            }

            if !columns_sent {
                let _ = app.emit(
                    &event_name,
                    QueryStreamEvent::Columns {
                        columns: String::new(),
                        total_rows: 0,
                    },
                );
            }

            client.batch_execute("CLOSE _rsql_cur").await.ok();
            client.batch_execute("COMMIT").await.ok();

            let elapsed = start.elapsed().as_millis() as f32;
            let _ = app.emit(&event_name, QueryStreamEvent::Done { elapsed, capped });
        }
        Err(_cursor_err) => {
            // DECLARE CURSOR failed (non-SELECT query like INSERT/UPDATE/DDL)
            client.batch_execute("ROLLBACK").await.ok();

            // Re-execute with simple_query for multi-statement support
            let messages = client
                .simple_query(sql)
                .await
                .map_err(|e| AppError::QueryFailed(e.to_string()))?;

            let (columns, rows) = process_simple_messages(messages);

            if columns.is_empty() {
                let _ = app.emit(
                    &event_name,
                    QueryStreamEvent::Columns {
                        columns: String::new(),
                        total_rows: 0,
                    },
                );
            } else {
                let header = join_sep(&columns, CELL_SEP);
                let _ = app.emit(
                    &event_name,
                    QueryStreamEvent::Columns {
                        columns: header,
                        total_rows: rows.len(),
                    },
                );

                let packed = pack_rows_vec(&rows);
                let _ = app.emit(&event_name, QueryStreamEvent::Chunk { data: packed });
            }

            let elapsed = start.elapsed().as_millis() as f32;
            let _ = app.emit(
                &event_name,
                QueryStreamEvent::Done {
                    elapsed,
                    capped: false,
                },
            );
        }
    }

    Ok(())
}
