use std::time::Instant;
use tokio_postgres::Client;

use crate::common::enums::AppError;

use super::super::ROW_SEP;
use super::super::wire::{Cell, pack_columns, pack_rows};
use super::helpers::process_simple_messages;

/// Execute a timed query and return (columns, rows, elapsed_ms).
/// Uses simple_query protocol — PG returns all values as text, no type conversion needed.
/// Supports multi-statement: returns the last result set that had rows.
pub async fn execute_query(
    client: &Client,
    sql: &str,
) -> Result<(Vec<String>, Vec<Vec<Cell>>, f32), AppError> {
    let start = Instant::now();
    let messages = client
        .simple_query(sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let (columns, rows) = process_simple_messages(messages);
    let elapsed = start.elapsed().as_millis() as f32;
    Ok((columns, rows, elapsed))
}

/// Execute a timed query and return results in compact packed string format.
/// Uses simple_query protocol with multi-statement support.
pub async fn execute_query_packed(client: &Client, sql: &str) -> Result<(String, f32), AppError> {
    let start = Instant::now();
    let messages = client
        .simple_query(sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let (columns, rows) = process_simple_messages(messages);

    if columns.is_empty() {
        return Ok((String::new(), start.elapsed().as_millis() as f32));
    }

    let header = pack_columns(&columns);
    let body = pack_rows(&rows);

    let packed = if body.is_empty() {
        header
    } else {
        let mut s = String::with_capacity(header.len() + 1 + body.len());
        s.push_str(&header);
        s.push(ROW_SEP);
        s.push_str(&body);
        s
    };
    let elapsed = start.elapsed().as_millis() as f32;
    Ok((packed, elapsed))
}
