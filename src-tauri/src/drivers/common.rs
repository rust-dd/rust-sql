use rayon::prelude::*;
use std::sync::Arc;
use std::time::Instant;
use tokio::time as tokio_time;
use tokio_postgres::{Client, SimpleQueryMessage};

use crate::common::enums::AppError;
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};

/// Safely get a client Arc from the AppState client map.
/// Returns a cloned Arc so the caller can drop the MutexGuard immediately.
pub fn get_client(
    clients_guard: &std::collections::BTreeMap<String, Arc<Client>>,
    project_id: &str,
) -> Result<Arc<Client>, AppError> {
    clients_guard
        .get(project_id)
        .cloned()
        .ok_or_else(|| AppError::ClientNotConnected(project_id.to_string()))
}

/// Process simple_query messages, returning the last result set that had rows.
/// If no result set had rows but commands ran, returns synthetic "N rows affected".
/// If nothing at all, returns empty vecs.
fn process_simple_messages(messages: Vec<SimpleQueryMessage>) -> (Vec<String>, Vec<Vec<String>>) {
    let mut cur_columns: Vec<String> = Vec::new();
    let mut cur_rows: Vec<Vec<String>> = Vec::new();
    let mut last_columns: Vec<String> = Vec::new();
    let mut last_rows: Vec<Vec<String>> = Vec::new();
    let mut has_row_result = false;
    let mut total_affected: u64 = 0;

    for msg in messages {
        match msg {
            SimpleQueryMessage::Row(row) => {
                let col_count = row.columns().len();
                if cur_columns.is_empty() {
                    cur_columns = Vec::with_capacity(col_count);
                    for c in row.columns() {
                        cur_columns.push(c.name().to_owned());
                    }
                }
                let mut cells = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    cells.push(row.get(i).unwrap_or("null").to_owned());
                }
                cur_rows.push(cells);
            }
            SimpleQueryMessage::CommandComplete(n) => {
                if !cur_rows.is_empty() {
                    last_columns = std::mem::take(&mut cur_columns);
                    last_rows = std::mem::take(&mut cur_rows);
                    has_row_result = true;
                } else {
                    cur_columns.clear();
                    cur_rows.clear();
                }
                total_affected += n;
            }
            _ => {}
        }
    }

    // Handle trailing rows (shouldn't happen but be safe)
    if !cur_rows.is_empty() {
        return (cur_columns, cur_rows);
    }

    if has_row_result {
        (last_columns, last_rows)
    } else if total_affected > 0 {
        (
            vec!["Result".into()],
            vec![vec![format!("{} rows affected", total_affected)]],
        )
    } else {
        (Vec::new(), Vec::new())
    }
}

/// Execute a timed query and return (columns, rows_as_strings, elapsed_ms).
/// Uses simple_query protocol — PG returns all values as text, no type conversion needed.
/// Supports multi-statement: returns the last result set that had rows.
pub async fn execute_query(
    client: &Client,
    sql: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32), AppError> {
    let start = Instant::now();
    let messages = client
        .simple_query(sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let (columns, rows) = process_simple_messages(messages);
    let elapsed = start.elapsed().as_millis() as f32;
    Ok((columns, rows, elapsed))
}

/// Cell separator for packed format (Unit Separator, ASCII 0x1F)
const CELL_SEP: char = '\x1F';
/// Row separator for packed format (Record Separator, ASCII 0x1E)
const ROW_SEP: char = '\x1E';

/// Join string slices with a char separator — avoids .to_string() on the separator.
#[inline]
fn join_sep(items: &[String], sep: char) -> String {
    let total: usize = items.iter().map(|s| s.len()).sum::<usize>() + items.len();
    let mut out = String::with_capacity(total);
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            out.push(sep);
        }
        out.push_str(item);
    }
    out
}

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
/// Rows fetched per cursor FETCH round-trip.
const CURSOR_FETCH_SIZE: usize = 10_000;

/// Execute a timed query and return results in compact packed string format.
/// Format: "col1\x1Fcol2\x1E row1val1\x1Frow1val2\x1E row2val1\x1Frow2val2"
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

    let header = join_sep(&columns, CELL_SEP);
    let body = pack_rows_vec(&rows);

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
                        let _ = client
                            .batch_execute("CLOSE _rsql_cur; ROLLBACK")
                            .await;
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

                // Emit columns on first batch
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

            // No rows at all
            if !columns_sent {
                let _ = app.emit(
                    &event_name,
                    QueryStreamEvent::Columns {
                        columns: String::new(),
                        total_rows: 0,
                    },
                );
            }

            // Clean up cursor + transaction
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

/// A cached query: pre-packed page strings for zero-copy serving.
/// Each page is a single large String (~1-2 MB) so the OS reclaims RSS on drop.
pub struct CachedQuery {
    pages: Vec<String>,
    page_size: usize,
}

/// In-memory virtual cache: query_id → pre-packed pages.
pub type VirtualCache = std::collections::BTreeMap<String, CachedQuery>;

/// Pack a slice of rows (each row = Vec<String>) into wire format.
/// Pre-allocates capacity and writes directly — zero intermediate allocations.
fn pack_rows_vec(rows: &[Vec<String>]) -> String {
    if rows.is_empty() {
        return String::new();
    }
    // Estimate capacity: avg ~20 chars per cell
    let est = rows.len() * rows.first().map_or(10, |r| r.len()) * 20;
    let mut out = String::with_capacity(est);

    for (ri, row) in rows.iter().enumerate() {
        if ri > 0 {
            out.push(ROW_SEP);
        }
        for (ci, cell) in row.iter().enumerate() {
            if ci > 0 {
                out.push(CELL_SEP);
            }
            // Inline separator sanitization — avoids .replace() allocations
            for ch in cell.chars() {
                if ch == CELL_SEP || ch == ROW_SEP {
                    out.push(' ');
                } else {
                    out.push(ch);
                }
            }
        }
    }
    out
}

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

/// Load schemas with a timeout. The query string is driver-specific.
pub async fn load_schemas(client: &Client, query_sql: &str) -> Result<PgsqlLoadSchemas, AppError> {
    let rows = tokio_time::timeout(
        tokio_time::Duration::from_secs(10),
        client.query(query_sql, &[]),
    )
    .await
    .map_err(|_| AppError::QueryTimeout)?
    .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| r.get(0)).collect())
}

/// Load tables for a given schema.
pub async fn load_tables(
    client: &Client,
    query_sql: &str,
    schema: &str,
) -> Result<PgsqlLoadTables, AppError> {
    let rows = client
        .query(query_sql, &[&schema])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| (r.get(0), r.get(1))).collect())
}

/// Load columns for a given schema and table.
pub async fn load_columns(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<PgsqlLoadColumns, AppError> {
    let rows = client
        .query(
            r#"SELECT column_name
               FROM information_schema.columns
               WHERE table_schema = $1 AND table_name = $2
               ORDER BY ordinal_position"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

/// Column detail info: (name, data_type, nullable, default_value)
pub type ColumnDetail = (String, String, bool, Option<String>);

/// Load detailed column info for a given schema and table.
pub async fn load_column_details(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_schema = $1 AND table_name = $2
               ORDER BY ordinal_position"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let data_type: String = r.get(1);
            let nullable_str: String = r.get(2);
            let default_val: Option<String> = r.get(3);
            (name, data_type, nullable_str == "YES", default_val)
        })
        .collect())
}

/// Index info: (index_name, column_name, is_unique, is_primary)
pub type IndexDetail = (String, String, bool, bool);

/// Load indexes for a given schema and table.
pub async fn load_indexes(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<IndexDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 i.relname AS index_name,
                 a.attname AS column_name,
                 ix.indisunique AS is_unique,
                 ix.indisprimary AS is_primary
               FROM pg_index ix
               JOIN pg_class t ON t.oid = ix.indrelid
               JOIN pg_class i ON i.oid = ix.indexrelid
               JOIN pg_namespace n ON n.oid = t.relnamespace
               JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
               WHERE n.nspname = $1 AND t.relname = $2
               ORDER BY i.relname, a.attnum"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let index_name: String = r.get(0);
            let column_name: String = r.get(1);
            let is_unique: bool = r.get(2);
            let is_primary: bool = r.get(3);
            (index_name, column_name, is_unique, is_primary)
        })
        .collect())
}

/// Trigger info: (trigger_name, event, timing)
pub type TriggerDetail = (String, String, String);

/// Load triggers for a given schema and table.
pub async fn load_triggers(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<TriggerDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT DISTINCT trigger_name, event_manipulation, action_timing
               FROM information_schema.triggers
               WHERE trigger_schema = $1 AND event_object_table = $2
               ORDER BY trigger_name"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let event: String = r.get(1);
            let timing: String = r.get(2);
            (name, event, timing)
        })
        .collect())
}

/// Rule info: (rule_name, event)
pub type RuleDetail = (String, String);

/// Load rules for a given schema and table.
pub async fn load_rules(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<RuleDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT rulename, ev_type
               FROM pg_rules
               WHERE schemaname = $1 AND tablename = $2
               ORDER BY rulename"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let event: String = r.get(1);
            (name, event)
        })
        .collect())
}

/// Policy info: (policy_name, permissive, command)
pub type PolicyDetail = (String, String, String);

/// Load RLS policies for a given schema and table.
pub async fn load_policies(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<PolicyDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT pol.polname,
                      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
                      CASE pol.polcmd
                        WHEN 'r' THEN 'SELECT'
                        WHEN 'a' THEN 'INSERT'
                        WHEN 'w' THEN 'UPDATE'
                        WHEN 'd' THEN 'DELETE'
                        WHEN '*' THEN 'ALL'
                        ELSE pol.polcmd::text
                      END
               FROM pg_policy pol
               JOIN pg_class c ON c.oid = pol.polrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = $1 AND c.relname = $2
               ORDER BY pol.polname"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let perm: String = r.get(1);
            let cmd: String = r.get(2);
            (name, perm, cmd)
        })
        .collect())
}

/// View info: (view_name)
pub async fn load_views(client: &Client, schema: &str) -> Result<Vec<String>, AppError> {
    let rows = client
        .query(
            r#"SELECT table_name
               FROM information_schema.views
               WHERE table_schema = $1
               ORDER BY table_name"#,
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

/// Load materialized views for a schema.
pub async fn load_materialized_views(
    client: &Client,
    schema: &str,
) -> Result<Vec<String>, AppError> {
    let rows = client
        .query(
            r#"SELECT matviewname
               FROM pg_matviews
               WHERE schemaname = $1
               ORDER BY matviewname"#,
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

/// Function info: (name, return_type, arguments)
pub type FunctionInfo = (String, String, String);

/// Load functions for a schema (excluding trigger functions and aggregates).
pub async fn load_functions(client: &Client, schema: &str) -> Result<Vec<FunctionInfo>, AppError> {
    let rows = client
        .query(
            r#"SELECT p.proname,
                      pg_get_function_result(p.oid),
                      pg_get_function_arguments(p.oid)
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = $1
                 AND p.prokind IN ('f', 'p')
                 AND pg_get_function_result(p.oid) != 'trigger'
               ORDER BY p.proname"#,
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let ret: String = r.get(1);
            let args: String = r.get(2);
            (name, ret, args)
        })
        .collect())
}

/// Load trigger functions for a schema (functions that return trigger).
pub async fn load_trigger_functions(
    client: &Client,
    schema: &str,
) -> Result<Vec<(String, String)>, AppError> {
    let rows = client
        .query(
            r#"SELECT p.proname,
                      pg_get_function_arguments(p.oid)
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = $1
                 AND pg_get_function_result(p.oid) = 'trigger'
               ORDER BY p.proname"#,
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let args: String = r.get(1);
            (name, args)
        })
        .collect())
}

/// Database stats: (stat_name, stat_value)
pub type DbStat = (String, String);

/// Load pg_stat_activity - active connections and queries.
pub async fn load_activity(client: &Client) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 pid::text,
                 COALESCE(usename, '') AS usename,
                 COALESCE(datname, '') AS datname,
                 COALESCE(state, 'unknown') AS state,
                 COALESCE(wait_event_type, '') AS wait_event_type,
                 COALESCE(wait_event, '') AS wait_event,
                 COALESCE(LEFT(query, 500), '') AS query,
                 COALESCE(EXTRACT(EPOCH FROM (now() - query_start))::text, '0') AS duration_sec,
                 COALESCE(backend_type, '') AS backend_type,
                 COALESCE(client_addr::text, 'local') AS client_addr
               FROM pg_stat_activity
               WHERE datname = current_database()
               ORDER BY state, query_start NULLS LAST"#,
            &[],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| (0..10).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}

/// Load pg_stat_database - database-level stats.
pub async fn load_database_stats(client: &Client) -> Result<Vec<DbStat>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 'Active Connections' AS stat, numbackends::text AS val FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Transactions Committed', xact_commit::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Transactions Rolled Back', xact_rollback::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Blocks Read (disk)', blks_read::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Blocks Hit (cache)', blks_hit::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Cache Hit Ratio',
                 CASE WHEN (blks_hit + blks_read) > 0
                   THEN ROUND(blks_hit::numeric / (blks_hit + blks_read) * 100, 2)::text || '%'
                   ELSE 'N/A'
                 END
               FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Rows Returned', tup_returned::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Rows Fetched', tup_fetched::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Rows Inserted', tup_inserted::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Rows Updated', tup_updated::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Rows Deleted', tup_deleted::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Temp Files', temp_files::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Temp Bytes', pg_size_pretty(temp_bytes) FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Deadlocks', deadlocks::text FROM pg_stat_database WHERE datname = current_database()
               UNION ALL
               SELECT 'Database Size', pg_size_pretty(pg_database_size(current_database()))"#,
            &[],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let val: String = r.get(1);
            (name, val)
        })
        .collect())
}

/// Load pg_stat_user_tables - table-level stats.
pub async fn load_table_stats(client: &Client) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 schemaname,
                 relname,
                 COALESCE(seq_scan, 0)::text AS seq_scan,
                 COALESCE(seq_tup_read, 0)::text AS seq_tup_read,
                 COALESCE(idx_scan, 0)::text AS idx_scan,
                 COALESCE(idx_tup_fetch, 0)::text AS idx_tup_fetch,
                 COALESCE(n_tup_ins, 0)::text AS inserts,
                 COALESCE(n_tup_upd, 0)::text AS updates,
                 COALESCE(n_tup_del, 0)::text AS deletes,
                 COALESCE(n_live_tup, 0)::text AS live_tuples,
                 COALESCE(n_dead_tup, 0)::text AS dead_tuples,
                 COALESCE(last_vacuum::text, 'never') AS last_vacuum,
                 COALESCE(last_autovacuum::text, 'never') AS last_autovacuum,
                 COALESCE(last_analyze::text, 'never') AS last_analyze
               FROM pg_stat_user_tables
               ORDER BY seq_scan + COALESCE(idx_scan, 0) DESC
               LIMIT 100"#,
            &[],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| (0..14).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}

/// Constraint info: (constraint_name, constraint_type, column_name)
pub type ConstraintDetail = (String, String, String);

/// Load constraints for a given schema and table.
pub async fn load_constraints(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<Vec<ConstraintDetail>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 tc.constraint_name,
                 tc.constraint_type,
                 COALESCE(kcu.column_name, '')
               FROM information_schema.table_constraints tc
               LEFT JOIN information_schema.key_column_usage kcu
                 ON kcu.constraint_name = tc.constraint_name
                 AND kcu.table_schema = tc.table_schema
                 AND kcu.table_name = tc.table_name
               WHERE tc.table_schema = $1 AND tc.table_name = $2
               ORDER BY tc.constraint_name, kcu.ordinal_position"#,
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            let ctype: String = r.get(1);
            let col: String = r.get(2);
            (name, ctype, col)
        })
        .collect())
}

/// FK relation: (source_table, source_column, target_table, target_column)
pub type ForeignKeyInfo = (String, String, String, String);

/// Load all foreign key relationships for a given schema.
pub async fn load_foreign_keys(
    client: &Client,
    schema: &str,
) -> Result<Vec<ForeignKeyInfo>, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 kcu.table_name AS source_table,
                 kcu.column_name AS source_column,
                 ccu.table_name AS target_table,
                 ccu.column_name AS target_column
               FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
               JOIN information_schema.constraint_column_usage ccu
                 ON ccu.constraint_name = tc.constraint_name
                 AND ccu.table_schema = tc.table_schema
               WHERE tc.constraint_type = 'FOREIGN KEY'
                 AND tc.table_schema = $1
               ORDER BY kcu.table_name, kcu.column_name"#,
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|r| {
            let src_table: String = r.get(0);
            let src_col: String = r.get(1);
            let tgt_table: String = r.get(2);
            let tgt_col: String = r.get(3);
            (src_table, src_col, tgt_table, tgt_col)
        })
        .collect())
}
