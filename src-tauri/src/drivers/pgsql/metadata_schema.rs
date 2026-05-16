use deadpool_postgres::Pool;
use tokio::time as tokio_time;
use tokio_postgres::Client;

use crate::common::enums::AppError;
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};

use super::{ColumnDetail, ConstraintDetail, IndexDetail, PolicyDetail, RuleDetail, TriggerDetail};

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

pub async fn load_databases(pool: &Pool) -> Result<Vec<String>, AppError> {
    let client = pool
        .get()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = client
        .query(
            "SELECT datname FROM pg_database WHERE datallowconn = true AND datistemplate = false ORDER BY datname",
            &[],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

pub async fn load_tablespaces(pool: &Pool) -> Result<Vec<(String, String, String)>, AppError> {
    let client = pool
        .get()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let rows = client
        .query(
            "SELECT spcname, pg_catalog.pg_get_userbyid(spcowner) AS owner, \
             COALESCE(pg_catalog.pg_tablespace_location(oid), '') AS location \
             FROM pg_catalog.pg_tablespace ORDER BY spcname",
            &[],
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(rows
        .iter()
        .map(|r| {
            (
                r.get::<_, String>(0),
                r.get::<_, String>(1),
                r.get::<_, String>(2),
            )
        })
        .collect())
}

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
