use rayon::prelude::*;
use std::time::Instant;
use tokio_postgres::Client;

use crate::common::enums::AppError;

use super::super::{CELL_SEP, CachedQuery, ROW_SEP, VirtualCache};
use super::helpers::{join_sep, pack_rows_vec, process_simple_messages};

/// Execute a query in one shot using simple_query protocol.
/// Pre-packs results into page-sized strings cached in-memory.
/// Returns (columns_packed, total_rows, first_page_packed, elapsed_ms).
/// If the SQL is non-SELECT / returns 0 rows, returns empty columns_packed signal
/// with a synthetic affected-rows message in first_page_packed when applicable.
pub async fn execute_virtual(
    client: &Client,
    cache: &tokio::sync::Mutex<VirtualCache>,
    sql: &str,
    query_id: &str,
    page_size: usize,
) -> Result<(String, usize, String, f32), AppError> {
    let start = Instant::now();

    let messages = client
        .simple_query(sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let (columns, all_rows) = process_simple_messages(messages);

    // Non-SELECT or empty result
    if columns.is_empty() {
        let elapsed = start.elapsed().as_millis() as f32;
        return Ok((String::new(), 0, String::new(), elapsed));
    }

    // Synthetic "N rows affected" result — pass through as fallback format
    if columns.len() == 1 && columns[0] == "Result" {
        let mut fallback = String::with_capacity(64);
        fallback.push_str(&columns[0]);
        fallback.push(ROW_SEP);
        if let Some(r) = all_rows.first() {
            fallback.push_str(&join_sep(r, CELL_SEP));
        }
        let elapsed = start.elapsed().as_millis() as f32;
        return Ok((String::new(), 0, fallback, elapsed));
    }

    let total_rows = all_rows.len();

    // Pre-pack into pages — use rayon only for large results (>50K rows)
    let chunks: Vec<&[Vec<String>]> = all_rows.chunks(page_size).collect();
    let pages: Vec<String> = if total_rows > 50_000 {
        chunks
            .par_iter()
            .map(|chunk| pack_rows_vec(chunk))
            .collect()
    } else {
        chunks.iter().map(|chunk| pack_rows_vec(chunk)).collect()
    };

    let columns_packed = join_sep(&columns, CELL_SEP);
    let first_page_packed = pages.first().cloned().unwrap_or_default();

    // Store pre-packed pages in cache
    {
        let mut c = cache.lock().await;
        c.insert(query_id.to_string(), CachedQuery { pages, page_size });
    }

    let elapsed = start.elapsed().as_millis() as f32;
    Ok((columns_packed, total_rows, first_page_packed, elapsed))
}

/// Fetch a pre-packed page from the in-memory cache. O(1) — no packing at serve time.
pub async fn fetch_virtual_page(
    cache: &tokio::sync::Mutex<VirtualCache>,
    query_id: &str,
    _col_count: usize,
    offset: usize,
    _limit: usize,
) -> Result<String, AppError> {
    let c = cache.lock().await;
    let entry = c
        .get(query_id)
        .ok_or_else(|| AppError::QueryFailed(format!("Virtual query {} not found", query_id)))?;

    let page_index = offset / entry.page_size;
    Ok(entry.pages.get(page_index).cloned().unwrap_or_default())
}

/// Remove a query from the in-memory cache. Large page strings are freed → OS reclaims RSS.
pub async fn close_virtual(
    cache: &tokio::sync::Mutex<VirtualCache>,
    query_id: &str,
) -> Result<(), AppError> {
    let mut c = cache.lock().await;
    c.remove(query_id);
    Ok(())
}
