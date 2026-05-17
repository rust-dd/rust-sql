use tokio_postgres::Client;

use crate::error::AppError;

use super::{FunctionInfo, ObjectStats};

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

pub async fn load_view_info(
    client: &Client,
    schema: &str,
    view: &str,
) -> Result<ObjectStats, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 COALESCE(v.is_updatable, 'NO'),
                 COALESCE(v.check_option, 'NONE'),
                 pg_get_viewdef(c.oid, true)
               FROM information_schema.views v
               JOIN pg_class c ON c.relname = v.table_name
               JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = v.table_schema
               WHERE v.table_schema = $1 AND v.table_name = $2
               LIMIT 1"#,
            &[&schema, &view],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    if let Some(row) = rows.first() {
        Ok(vec![
            ("is_updatable".into(), row.get::<_, String>(0)),
            ("check_option".into(), row.get::<_, String>(1)),
            ("definition".into(), row.get::<_, String>(2)),
        ])
    } else {
        Ok(Vec::new())
    }
}

pub async fn load_matview_info(
    client: &Client,
    schema: &str,
    matview: &str,
) -> Result<ObjectStats, AppError> {
    let sql = r#"SELECT
         c.reltuples::bigint::text,
         pg_size_pretty(pg_total_relation_size(c.oid)),
         CASE WHEN m.ispopulated THEN 'YES' ELSE 'NO' END,
         m.definition
       FROM pg_matviews m
       JOIN pg_class c ON c.relname = m.matviewname
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = m.schemaname
       WHERE m.schemaname = $1 AND m.matviewname = $2
       LIMIT 1"#;

    let rows = client
        .query(sql, &[&schema, &matview])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    if let Some(row) = rows.first() {
        Ok(vec![
            ("row_estimate".into(), row.get::<_, String>(0)),
            ("total_size".into(), row.get::<_, String>(1)),
            ("is_populated".into(), row.get::<_, String>(2)),
            ("definition".into(), row.get::<_, String>(3)),
        ])
    } else {
        Ok(Vec::new())
    }
}

pub async fn load_function_info(
    client: &Client,
    schema: &str,
    func_name: &str,
) -> Result<ObjectStats, AppError> {
    let rows = client
        .query(
            r#"SELECT
                 l.lanname,
                 CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' ELSE '' END,
                 p.proisstrict::text,
                 p.prosecdef::text,
                 p.procost::text,
                 p.prorows::text,
                 pg_get_function_result(p.oid),
                 pg_get_function_arguments(p.oid),
                 p.prosrc
               FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               JOIN pg_language l ON l.oid = p.prolang
               WHERE n.nspname = $1 AND p.proname = $2
               LIMIT 1"#,
            &[&schema, &func_name],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let keys = [
        "language",
        "volatility",
        "is_strict",
        "security_definer",
        "estimated_cost",
        "estimated_rows",
        "return_type",
        "arguments",
        "source",
    ];

    if let Some(row) = rows.first() {
        Ok(keys
            .iter()
            .enumerate()
            .map(|(i, k)| {
                let val: Option<String> = row.try_get(i).ok();
                (k.to_string(), val.unwrap_or_default())
            })
            .collect())
    } else {
        Ok(Vec::new())
    }
}
