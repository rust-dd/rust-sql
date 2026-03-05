use std::time::Instant;
use rayon::prelude::*;
use tokio::time as tokio_time;
use tokio_postgres::Client;

use crate::common::enums::AppError;
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::utils::reflective_get;

/// Safely get a client reference from the AppState client map.
pub fn get_client<'a>(
    clients_guard: &'a std::collections::BTreeMap<String, Client>,
    project_id: &str,
) -> Result<&'a Client, AppError> {
    clients_guard
        .get(project_id)
        .ok_or_else(|| AppError::ClientNotConnected(project_id.to_string()))
}

/// Execute a timed query and return (columns, rows_as_strings, elapsed_ms).
pub async fn execute_query(
    client: &Client,
    sql: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>, f32), AppError> {
    let start = Instant::now();
    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    if rows.is_empty() {
        return Ok((Vec::new(), Vec::new(), 0.0f32));
    }

    let columns = rows[0]
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect::<Vec<String>>();

    // Use rayon for parallel row processing on large result sets
    let col_count = rows[0].len();
    let data: Vec<Vec<String>> = if rows.len() > 1000 {
        rows.par_iter()
            .map(|row| (0..col_count).map(|i| reflective_get(row, i)).collect())
            .collect()
    } else {
        rows.iter()
            .map(|row| (0..col_count).map(|i| reflective_get(row, i)).collect())
            .collect()
    };

    let elapsed = start.elapsed().as_millis() as f32;
    Ok((columns, data, elapsed))
}

/// Cell separator for packed format (Unit Separator, ASCII 0x1F)
const CELL_SEP: char = '\x1F';
/// Row separator for packed format (Record Separator, ASCII 0x1E)
const ROW_SEP: char = '\x1E';

/// Events emitted during streamed query execution.
#[derive(serde::Serialize, Clone)]
#[serde(tag = "type")]
pub enum QueryStreamEvent {
    #[serde(rename = "columns")]
    Columns { columns: String, total_rows: usize },
    #[serde(rename = "chunk")]
    Chunk { data: String },
    #[serde(rename = "done")]
    Done { elapsed: f32 },
}

/// Execute a timed query and return results in compact packed string format.
/// Format: "col1\x1Fcol2\x1E row1val1\x1Frow1val2\x1E row2val1\x1Frow2val2"
/// This avoids the massive JSON overhead of nested Vec<Vec<String>>.
pub async fn execute_query_packed(
    client: &Client,
    sql: &str,
) -> Result<(String, f32), AppError> {
    let start = Instant::now();
    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    if rows.is_empty() {
        return Ok((String::new(), 0.0f32));
    }

    let columns = rows[0]
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect::<Vec<String>>();

    let col_count = rows[0].len();
    let cell_sep = CELL_SEP.to_string();
    let row_sep = ROW_SEP.to_string();

    // Build header
    let header = columns.join(&cell_sep);

    // Use rayon for parallel row processing, then join
    let row_strings: Vec<String> = if rows.len() > 1000 {
        rows.par_iter()
            .map(|row| {
                (0..col_count)
                    .map(|i| {
                        // Replace separator chars in values to avoid corruption
                        reflective_get(row, i)
                            .replace(CELL_SEP, " ")
                            .replace(ROW_SEP, " ")
                    })
                    .collect::<Vec<_>>()
                    .join(&cell_sep)
            })
            .collect()
    } else {
        rows.iter()
            .map(|row| {
                (0..col_count)
                    .map(|i| {
                        reflective_get(row, i)
                            .replace(CELL_SEP, " ")
                            .replace(ROW_SEP, " ")
                    })
                    .collect::<Vec<_>>()
                    .join(&cell_sep)
            })
            .collect()
    };

    let packed = format!("{}{}{}", header, row_sep, row_strings.join(&row_sep));
    let elapsed = start.elapsed().as_millis() as f32;
    Ok((packed, elapsed))
}

/// Stream query results in chunks via Tauri events.
/// Each chunk uses the packed wire format (CELL_SEP / ROW_SEP).
pub async fn execute_query_streamed(
    client: &Client,
    sql: &str,
    stream_id: &str,
    app: &tauri::AppHandle,
) -> Result<(), AppError> {
    use tauri::Emitter;

    let start = Instant::now();
    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let event_name = format!("query-stream-{}", stream_id);

    if rows.is_empty() {
        let _ = app.emit(&event_name, QueryStreamEvent::Columns {
            columns: String::new(),
            total_rows: 0,
        });
        let _ = app.emit(&event_name, QueryStreamEvent::Done { elapsed: 0.0 });
        return Ok(());
    }

    let columns = rows[0]
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect::<Vec<String>>();

    let col_count = rows[0].len();
    let total_rows = rows.len();
    let cell_sep = CELL_SEP.to_string();
    let header = columns.join(&cell_sep);

    let _ = app.emit(&event_name, QueryStreamEvent::Columns {
        columns: header,
        total_rows,
    });

    const CHUNK_SIZE: usize = 5000;
    let row_sep = ROW_SEP.to_string();

    for chunk in rows.chunks(CHUNK_SIZE) {
        let row_strings: Vec<String> = if chunk.len() > 1000 {
            chunk
                .par_iter()
                .map(|row| {
                    (0..col_count)
                        .map(|i| {
                            reflective_get(row, i)
                                .replace(CELL_SEP, " ")
                                .replace(ROW_SEP, " ")
                        })
                        .collect::<Vec<_>>()
                        .join(&cell_sep)
                })
                .collect()
        } else {
            chunk
                .iter()
                .map(|row| {
                    (0..col_count)
                        .map(|i| {
                            reflective_get(row, i)
                                .replace(CELL_SEP, " ")
                                .replace(ROW_SEP, " ")
                        })
                        .collect::<Vec<_>>()
                        .join(&cell_sep)
                })
                .collect()
        };

        let packed_chunk = row_strings.join(&row_sep);
        let _ = app.emit(&event_name, QueryStreamEvent::Chunk { data: packed_chunk });
    }

    let elapsed = start.elapsed().as_millis() as f32;
    let _ = app.emit(&event_name, QueryStreamEvent::Done { elapsed });

    Ok(())
}

/// Load schemas with a timeout. The query string is driver-specific.
pub async fn load_schemas(
    client: &Client,
    query_sql: &str,
) -> Result<PgsqlLoadSchemas, AppError> {
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
pub async fn load_views(
    client: &Client,
    schema: &str,
) -> Result<Vec<String>, AppError> {
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
pub async fn load_functions(
    client: &Client,
    schema: &str,
) -> Result<Vec<FunctionInfo>, AppError> {
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
        .map(|r| {
            (0..10)
                .map(|i| r.get::<_, String>(i))
                .collect()
        })
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
        .map(|r| {
            (0..14)
                .map(|i| r.get::<_, String>(i))
                .collect()
        })
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
