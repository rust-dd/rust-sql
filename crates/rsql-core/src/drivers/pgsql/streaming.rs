use std::sync::Arc;
use std::time::Instant;
use tokio_postgres::{Client, SimpleQueryMessage};

use crate::drivers::pgsql::CELL_SEP;
use crate::drivers::pgsql::query_execution::{join_sep, pack_rows_vec, process_simple_messages};
use crate::error::AppError;
use crate::events::EventSink;

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

const MAX_STREAM_ROWS: usize = 500_000;
const CURSOR_FETCH_SIZE: usize = 10_000;

pub async fn execute_query_streamed<S: EventSink>(
    client: &Client,
    sql: &str,
    stream_id: &str,
    sink: &Arc<S>,
) -> Result<(), AppError> {
    let start = Instant::now();
    let event_name = format!("query-stream-{stream_id}");

    client
        .batch_execute("BEGIN")
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let cursor_sql = format!("DECLARE _rsql_cur NO SCROLL CURSOR FOR {sql}");
    match client.batch_execute(&cursor_sql).await {
        Ok(_) => {
            let fetch_sql = format!("FETCH {CURSOR_FETCH_SIZE} FROM _rsql_cur");
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
                    sink.emit(&event_name, &QueryStreamEvent::Columns { columns: header, total_rows: 0 });
                    columns_sent = true;
                }

                let packed = pack_rows_vec(&batch_rows);
                sink.emit(&event_name, &QueryStreamEvent::Chunk { data: packed });

                total_sent += batch_rows.len();
                if total_sent >= MAX_STREAM_ROWS {
                    capped = true;
                    break;
                }
            }

            if !columns_sent {
                sink.emit(
                    &event_name,
                    &QueryStreamEvent::Columns { columns: String::new(), total_rows: 0 },
                );
            }

            client.batch_execute("CLOSE _rsql_cur").await.ok();
            client.batch_execute("COMMIT").await.ok();

            let elapsed = start.elapsed().as_millis() as f32;
            sink.emit(&event_name, &QueryStreamEvent::Done { elapsed, capped });
        }
        Err(_) => {
            client.batch_execute("ROLLBACK").await.ok();

            let messages = client
                .simple_query(sql)
                .await
                .map_err(|e| AppError::QueryFailed(e.to_string()))?;

            let (columns, rows) = process_simple_messages(messages);

            if columns.is_empty() {
                sink.emit(
                    &event_name,
                    &QueryStreamEvent::Columns { columns: String::new(), total_rows: 0 },
                );
            } else {
                let header = join_sep(&columns, CELL_SEP);
                sink.emit(
                    &event_name,
                    &QueryStreamEvent::Columns { columns: header, total_rows: rows.len() },
                );

                let packed = pack_rows_vec(&rows);
                sink.emit(&event_name, &QueryStreamEvent::Chunk { data: packed });
            }

            let elapsed = start.elapsed().as_millis() as f32;
            sink.emit(
                &event_name,
                &QueryStreamEvent::Done { elapsed, capped: false },
            );
        }
    }

    Ok(())
}
