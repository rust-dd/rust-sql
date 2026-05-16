use crate::common::enums::AppError;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SchemaObject {
    pub object_type: String,
    pub name: String,
    pub definition: String,
}

pub async fn extract_schema_objects(
    client: &deadpool_postgres::Client,
    schema: &str,
) -> Result<Vec<SchemaObject>, AppError> {
    let mut objects = Vec::new();

    let rows = client
        .query(
            "SELECT c.relname,
                    string_agg(
                        a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) ||
                        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
                        COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''),
                        ', ' ORDER BY a.attnum
                    )
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
             LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
             WHERE n.nspname = $1 AND c.relkind = 'r'
             GROUP BY c.relname ORDER BY c.relname",
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    for row in &rows {
        objects.push(SchemaObject {
            object_type: "table".to_string(),
            name: row.get(0),
            definition: row.get::<_, Option<String>>(1).unwrap_or_default(),
        });
    }

    let rows = client
        .query(
            "SELECT viewname, definition FROM pg_views WHERE schemaname = $1 ORDER BY viewname",
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    for row in &rows {
        objects.push(SchemaObject {
            object_type: "view".to_string(),
            name: row.get(0),
            definition: row.get::<_, Option<String>>(1).unwrap_or_default(),
        });
    }

    let rows = client
        .query(
            "SELECT matviewname, definition FROM pg_matviews WHERE schemaname = $1 ORDER BY matviewname",
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    for row in &rows {
        objects.push(SchemaObject {
            object_type: "matview".to_string(),
            name: row.get(0),
            definition: row.get::<_, Option<String>>(1).unwrap_or_default(),
        });
    }

    let rows = client
        .query(
            "SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                    COALESCE(pg_get_functiondef(p.oid), '')
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = $1 ORDER BY p.proname",
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    for row in &rows {
        objects.push(SchemaObject {
            object_type: "function".to_string(),
            name: row.get(0),
            definition: row.get::<_, Option<String>>(1).unwrap_or_default(),
        });
    }

    let rows = client
        .query(
            "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname",
            &[&schema],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    for row in &rows {
        objects.push(SchemaObject {
            object_type: "index".to_string(),
            name: row.get(0),
            definition: row.get::<_, Option<String>>(1).unwrap_or_default(),
        });
    }

    Ok(objects)
}

pub async fn discover_notify_channels(
    client: &deadpool_postgres::Client,
) -> Result<Vec<String>, AppError> {
    // Extract channel names from:
    // 1. pg_notify() calls in trigger function bodies
    // 2. NOTIFY statements in trigger function bodies
    // 3. Currently active listeners from pg_stat_activity
    let rows = client
        .query(
            r#"SELECT DISTINCT channel FROM (
                SELECT (regexp_matches(prosrc, 'pg_notify\s*\(\s*''([^'']+)''', 'gi'))[1] AS channel
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
              UNION
                SELECT (regexp_matches(prosrc, '\mNOTIFY\s+([a-zA-Z_][a-zA-Z0-9_]*)', 'gi'))[1] AS channel
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            ) sub
            WHERE channel IS NOT NULL
            ORDER BY channel"#,
            &[],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}
