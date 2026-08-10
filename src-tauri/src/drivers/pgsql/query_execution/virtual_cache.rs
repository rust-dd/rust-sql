use futures_util::{TryStreamExt, pin_mut};
use std::time::Instant;
use tokio_postgres::{Client, SimpleQueryMessage};

use crate::common::enums::AppError;

use super::super::wire::{ROW_SEP, pack_columns, push_row};
use super::super::{CachedQuery, VirtualCache};
use super::helpers::{column_names, row_cells};

/// Ceilings on what one result may hold in memory. Reaching either stops
/// accumulation and marks the result capped. This bounds the client only:
/// the server still finishes sending the rows it was asked for. Bounding the
/// server too needs a cursor, which needs a connection pinned for the cursor's
/// lifetime and is a separate change.
const MAX_VIRTUAL_ROWS: usize = 1_000_000;
const MAX_VIRTUAL_BYTES: usize = 512 * 1024 * 1024;

/// Rows packed straight into page-sized strings as they arrive, so the full
/// result never exists as a second, unpacked copy.
#[derive(Default)]
struct PageAccumulator {
    columns: Vec<String>,
    pages: Vec<String>,
    current: String,
    rows_in_page: usize,
    total_rows: usize,
    packed_bytes: usize,
}

impl PageAccumulator {
    fn push(&mut self, row: &tokio_postgres::SimpleQueryRow, page_size: usize) {
        if self.columns.is_empty() {
            self.columns = column_names(row);
        }
        if self.rows_in_page == page_size {
            self.packed_bytes += self.current.len();
            self.pages.push(std::mem::take(&mut self.current));
            self.rows_in_page = 0;
        }
        if self.rows_in_page > 0 {
            self.current.push(ROW_SEP);
        }
        push_row(&mut self.current, &row_cells(row));
        self.rows_in_page += 1;
        self.total_rows += 1;
    }

    fn at_limit(&self) -> bool {
        self.total_rows >= MAX_VIRTUAL_ROWS
            || self.packed_bytes + self.current.len() >= MAX_VIRTUAL_BYTES
    }

    fn finish(mut self) -> Self {
        if self.rows_in_page > 0 {
            self.pages.push(std::mem::take(&mut self.current));
            self.rows_in_page = 0;
        }
        self
    }

    fn is_empty(&self) -> bool {
        self.total_rows == 0
    }
}

/// Execute a query and pre-pack its rows into page-sized strings held in memory.
/// Returns (columns_packed, total_rows, first_page_packed, elapsed_ms, capped).
/// A non-SELECT or empty result returns empty columns_packed, with a synthetic
/// affected-rows message in first_page_packed when applicable.
pub async fn execute_virtual(
    client: &Client,
    cache: &tokio::sync::Mutex<VirtualCache>,
    sql: &str,
    query_id: &str,
    page_size: usize,
) -> Result<(String, usize, String, f32, bool), AppError> {
    let start = Instant::now();

    let stream = client
        .simple_query_raw(sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    pin_mut!(stream);

    let mut accum = PageAccumulator::default();
    let mut last: Option<PageAccumulator> = None;
    let mut total_affected: u64 = 0;
    let mut capped = false;

    while let Some(message) = stream
        .try_next()
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?
    {
        match message {
            SimpleQueryMessage::Row(row) => {
                accum.push(&row, page_size);
                if accum.at_limit() {
                    capped = true;
                    break;
                }
            }
            // Multi-statement scripts report the last statement that had rows,
            // matching what the non-virtual paths do.
            SimpleQueryMessage::CommandComplete(n) => {
                total_affected += n;
                if !accum.is_empty() {
                    last = Some(std::mem::take(&mut accum).finish());
                } else {
                    accum = PageAccumulator::default();
                }
            }
            _ => {}
        }
    }

    let result = if accum.is_empty() {
        last.unwrap_or_default()
    } else {
        accum.finish()
    };

    let elapsed = start.elapsed().as_millis() as f32;

    if result.columns.is_empty() {
        if total_affected > 0 {
            let mut fallback = String::with_capacity(64);
            fallback.push_str("Result");
            fallback.push(ROW_SEP);
            fallback.push_str(&format!("{} rows affected", total_affected));
            return Ok((String::new(), 0, fallback, elapsed, false));
        }
        return Ok((String::new(), 0, String::new(), elapsed, false));
    }

    let columns_packed = pack_columns(&result.columns);
    let first_page_packed = result.pages.first().cloned().unwrap_or_default();
    let total_rows = result.total_rows;

    {
        let mut c = cache.lock().await;
        c.insert(
            query_id.to_string(),
            CachedQuery {
                pages: result.pages,
                page_size,
            },
        );
    }

    Ok((
        columns_packed,
        total_rows,
        first_page_packed,
        elapsed,
        capped,
    ))
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

#[cfg(test)]
mod tests {
    use super::super::super::wire::CELL_SEP;
    use super::*;

    fn accumulate(rows: &[Vec<Option<&str>>], page_size: usize) -> PageAccumulator {
        let mut accum = PageAccumulator {
            columns: vec!["a".to_string()],
            ..Default::default()
        };
        for row in rows {
            if accum.rows_in_page == page_size {
                accum.packed_bytes += accum.current.len();
                accum.pages.push(std::mem::take(&mut accum.current));
                accum.rows_in_page = 0;
            }
            if accum.rows_in_page > 0 {
                accum.current.push(ROW_SEP);
            }
            let cells: Vec<Option<String>> = row.iter().map(|c| c.map(str::to_string)).collect();
            push_row(&mut accum.current, &cells);
            accum.rows_in_page += 1;
            accum.total_rows += 1;
        }
        accum.finish()
    }

    #[test]
    fn rows_are_split_into_pages_of_the_requested_size() {
        let rows: Vec<Vec<Option<&str>>> = (0..5).map(|_| vec![Some("x")]).collect();
        let accum = accumulate(&rows, 2);
        assert_eq!(accum.pages.len(), 3);
        assert_eq!(accum.total_rows, 5);
    }

    #[test]
    fn a_partial_final_page_is_kept() {
        let rows: Vec<Vec<Option<&str>>> = (0..3).map(|_| vec![Some("x")]).collect();
        let accum = accumulate(&rows, 2);
        assert_eq!(accum.pages.len(), 2);
        assert_eq!(accum.pages[1].split(ROW_SEP).count(), 1);
    }

    #[test]
    fn an_exactly_full_page_produces_no_trailing_empty_page() {
        let rows: Vec<Vec<Option<&str>>> = (0..4).map(|_| vec![Some("x")]).collect();
        let accum = accumulate(&rows, 2);
        assert_eq!(accum.pages.len(), 2);
    }

    #[test]
    fn nulls_survive_page_packing() {
        let accum = accumulate(&[vec![None], vec![Some("null")]], 10);
        let page = &accum.pages[0];
        let mut rows = page.split(ROW_SEP);
        assert_eq!(rows.next().unwrap(), "\u{1D}N");
        assert_eq!(rows.next().unwrap(), "null");
    }

    #[test]
    fn separators_in_data_do_not_break_page_boundaries() {
        let accum = accumulate(&[vec![Some("a\u{1E}b")], vec![Some("c")]], 10);
        assert_eq!(accum.pages[0].split(ROW_SEP).count(), 2);
        assert_eq!(accum.pages[0].split(CELL_SEP).count(), 1);
    }

    #[test]
    fn an_empty_accumulator_reports_empty() {
        assert!(PageAccumulator::default().is_empty());
    }
}
