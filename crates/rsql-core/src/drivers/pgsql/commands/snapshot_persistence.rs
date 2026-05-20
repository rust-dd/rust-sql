use std::time::{SystemTime, UNIX_EPOCH};

use crate::AppState;
use crate::drivers::pgsql::CELL_SEP;
use crate::drivers::pgsql::query_execution::execute_virtual;
use crate::error::AppError;

use tokio::time::{Duration, sleep};

use super::SNAPSHOT_PAGE_WRITE_RETRIES;
use super::pool_helpers::{acquire_client, is_sqlite_lock_error, set_cancel_token};

#[derive(Clone)]
pub struct VirtualSnapshotMeta {
    pub project_id: String,
    pub sql: String,
    pub page_size: usize,
    pub col_count: usize,
}

pub fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

pub async fn snapshot_upsert_metadata(
    app_state: &AppState,
    project_id: &str,
    query_id: &str,
    sql: &str,
    columns_packed: &str,
    total_rows: usize,
    page_size: usize,
    col_count: usize,
) -> std::result::Result<(), AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "INSERT OR REPLACE INTO virtual_query_snapshots (
            query_id, project_id, sql, columns_packed, total_rows, page_size, col_count, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        libsql::params![
            query_id,
            project_id,
            sql,
            columns_packed,
            total_rows as i64,
            page_size as i64,
            col_count as i64,
            now_unix_secs(),
        ],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

pub async fn snapshot_store_page(
    app_state: &AppState,
    query_id: &str,
    page_index: usize,
    packed_page: &str,
) -> std::result::Result<(), AppError> {
    if packed_page.is_empty() {
        return Ok(());
    }

    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    for attempt in 0..SNAPSHOT_PAGE_WRITE_RETRIES {
        match conn
            .execute(
                "INSERT OR IGNORE INTO virtual_query_pages (query_id, page_index, packed_page)
                 VALUES (?1, ?2, ?3)",
                libsql::params![query_id, page_index as i64, packed_page],
            )
            .await
        {
            Ok(_) => return Ok(()),
            Err(e) => {
                let msg = e.to_string();
                if is_sqlite_lock_error(&msg) {
                    if attempt + 1 < SNAPSHOT_PAGE_WRITE_RETRIES {
                        sleep(Duration::from_millis((attempt as u64 + 1) * 8)).await;
                        continue;
                    }
                    // Snapshot persistence is best-effort; skip noisy lock errors.
                    tracing::debug!(
                        "Skipping snapshot page persist for {} page {} due to SQLite lock",
                        query_id,
                        page_index
                    );
                    return Ok(());
                }
                return Err(AppError::DatabaseError(msg));
            }
        }
    }

    Ok(())
}

pub async fn snapshot_load_page(
    app_state: &AppState,
    query_id: &str,
    page_index: usize,
) -> std::result::Result<Option<String>, AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT packed_page
             FROM virtual_query_pages
             WHERE query_id = ?1 AND page_index = ?2
             LIMIT 1",
            libsql::params![query_id, page_index as i64],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let maybe_row = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    if let Some(row) = maybe_row {
        let packed: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(Some(packed))
    } else {
        Ok(None)
    }
}

pub async fn snapshot_load_metadata(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<Option<VirtualSnapshotMeta>, AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT project_id, sql, page_size, col_count
             FROM virtual_query_snapshots
             WHERE query_id = ?1
             LIMIT 1",
            libsql::params![query_id],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let maybe_row = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let Some(row) = maybe_row else {
        return Ok(None);
    };

    let project_id: String = row
        .get(0)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let sql: String = row
        .get(1)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let page_size_i64: i64 = row
        .get(2)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let col_count_i64: i64 = row
        .get(3)
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    if page_size_i64 <= 0 {
        return Ok(None);
    }

    Ok(Some(VirtualSnapshotMeta {
        project_id,
        sql,
        page_size: page_size_i64 as usize,
        col_count: col_count_i64.max(0) as usize,
    }))
}

pub async fn snapshot_cleanup_query(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<(), AppError> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_pages WHERE query_id = ?1",
        libsql::params![query_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_snapshots WHERE query_id = ?1",
        libsql::params![query_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

pub async fn restore_virtual_from_snapshot(
    app_state: &AppState,
    query_id: &str,
) -> std::result::Result<bool, AppError> {
    let Some(meta) = snapshot_load_metadata(app_state, query_id).await? else {
        return Ok(false);
    };

    let client = acquire_client(&app_state.clients, &meta.project_id).await?;
    set_cancel_token(app_state, &meta.project_id, client.cancel_token()).await?;

    let (columns_packed, total_rows, first_page_packed, _) = execute_virtual(
        &client,
        &app_state.virtual_cache,
        &meta.sql,
        query_id,
        meta.page_size,
    )
    .await?;

    if columns_packed.is_empty() {
        return Ok(false);
    }

    let col_count = if meta.col_count > 0 {
        meta.col_count
    } else {
        columns_packed.split(CELL_SEP).count()
    };

    if let Err(e) = snapshot_upsert_metadata(
        app_state,
        &meta.project_id,
        query_id,
        &meta.sql,
        &columns_packed,
        total_rows,
        meta.page_size,
        col_count,
    )
    .await
    {
        tracing::warn!(
            "Failed to refresh snapshot metadata for {}: {:?}",
            query_id,
            e
        );
    }
    if let Err(e) = snapshot_store_page(app_state, query_id, 0, &first_page_packed).await {
        tracing::warn!(
            "Failed to refresh snapshot first page for {}: {:?}",
            query_id,
            e
        );
    }

    Ok(true)
}
