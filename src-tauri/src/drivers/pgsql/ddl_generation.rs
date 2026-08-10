use tokio_postgres::{Client, SimpleQueryMessage};

use crate::common::enums::AppError;

pub async fn generate_full_ddl(
    client: &Client,
    schema: &str,
    name: &str,
    object_type: &str, // "table", "view", "matview", "function"
) -> Result<String, AppError> {
    match object_type {
        "table" => generate_table_ddl(client, schema, name).await,
        "view" => generate_view_ddl(client, schema, name).await,
        "matview" => generate_matview_ddl(client, schema, name).await,
        "function" | "trigger-function" => generate_function_ddl(client, schema, name).await,
        _ => Err(AppError::QueryFailed(format!(
            "Unknown object type: {}",
            object_type
        ))),
    }
}

async fn generate_table_ddl(
    client: &Client,
    schema: &str,
    table: &str,
) -> Result<String, AppError> {
    // Use simple_query so we can handle the complex CTE in one shot
    let sql = format!(
        r#"WITH col_ddl AS (
  SELECT ordinal_position,
    '  "' || column_name || '" ' ||
    CASE
      WHEN udt_name = 'varchar' THEN 'character varying' || COALESCE('(' || character_maximum_length || ')', '')
      WHEN udt_name = 'bpchar'  THEN 'character'          || COALESCE('(' || character_maximum_length || ')', '')
      WHEN udt_name = 'numeric' AND numeric_precision IS NOT NULL THEN 'numeric(' || numeric_precision || COALESCE(',' || numeric_scale, '') || ')'
      ELSE data_type
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END AS col_def
  FROM information_schema.columns
  WHERE table_schema = '{schema}' AND table_name = '{table}'
)
SELECT string_agg(col_def, E',\n' ORDER BY ordinal_position) FROM col_ddl"#
    );

    let col_result = client
        .simple_query(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    let mut col_defs = String::new();
    for msg in &col_result {
        if let SimpleQueryMessage::Row(row) = msg {
            col_defs = row.get(0).unwrap_or("").to_string();
        }
    }

    let mut ddl = format!("CREATE TABLE \"{schema}\".\"{table}\" (\n{col_defs}\n);\n");

    fn collect_lines(messages: &[SimpleQueryMessage]) -> Vec<String> {
        let mut out = Vec::new();
        for msg in messages {
            if let SimpleQueryMessage::Row(row) = msg
                && let Some(line) = row.get(0)
                && !line.is_empty()
            {
                out.push(line.to_string());
            }
        }
        out
    }

    let con_sql = format!(
        r#"SELECT 'ALTER TABLE "{schema}"."{table}" ADD CONSTRAINT "' || con.conname || '" ' || pg_get_constraintdef(con.oid) || ';'
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = '{schema}' AND c.relname = '{table}'
           ORDER BY CASE con.contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'f' THEN 2 ELSE 3 END"#
    );
    let con_result = client
        .simple_query(&con_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&con_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let idx_sql = format!(
        r#"SELECT pg_get_indexdef(i.indexrelid) || ';'
           FROM pg_index i
           JOIN pg_class tbl ON tbl.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = tbl.relnamespace
           WHERE n.nspname = '{schema}' AND tbl.relname = '{table}'
             AND NOT i.indisprimary
             AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)"#
    );
    let idx_result = client
        .simple_query(&idx_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&idx_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let trig_sql = format!(
        r#"SELECT pg_get_triggerdef(t.oid) || ';'
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = '{schema}' AND c.relname = '{table}'
             AND NOT t.tgisinternal"#
    );
    let trig_result = client
        .simple_query(&trig_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&trig_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let rls_sql = format!(
        r#"SELECT CASE WHEN c.relrowsecurity THEN 'ALTER TABLE "{schema}"."{table}" ENABLE ROW LEVEL SECURITY;' ELSE '' END
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = '{schema}' AND c.relname = '{table}'"#
    );
    let rls_result = client
        .simple_query(&rls_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&rls_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let pol_sql = format!(
        r#"SELECT 'CREATE POLICY "' || pol.polname || '" ON "{schema}"."{table}"' ||
             CASE pol.polcmd WHEN 'r' THEN ' FOR SELECT' WHEN 'a' THEN ' FOR INSERT' WHEN 'w' THEN ' FOR UPDATE' WHEN 'd' THEN ' FOR DELETE' WHEN '*' THEN '' END ||
             CASE WHEN pol.polpermissive THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END ||
             COALESCE(E'\n  USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')', '') ||
             COALESCE(E'\n  WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')', '') ||
             ';'
           FROM pg_policy pol
           JOIN pg_class c ON c.oid = pol.polrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = '{schema}' AND c.relname = '{table}'"#
    );
    let pol_result = client
        .simple_query(&pol_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&pol_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let cmt_sql = format!(
        r#"SELECT 'COMMENT ON TABLE "{schema}"."{table}" IS ' || quote_literal(d.description) || ';'
           FROM pg_description d
           JOIN pg_class c ON c.oid = d.objoid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = '{schema}' AND c.relname = '{table}' AND d.objsubid = 0"#
    );
    let cmt_result = client
        .simple_query(&cmt_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&cmt_result) {
        ddl.push('\n');
        ddl.push_str(&line);
        ddl.push('\n');
    }

    let col_cmt_sql = format!(
        r#"SELECT 'COMMENT ON COLUMN "{schema}"."{table}"."' || a.attname || '" IS ' || quote_literal(d.description) || ';'
           FROM pg_description d
           JOIN pg_class c ON c.oid = d.objoid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
           WHERE n.nspname = '{schema}' AND c.relname = '{table}' AND d.objsubid > 0
           ORDER BY d.objsubid"#
    );
    let col_cmt_result = client
        .simple_query(&col_cmt_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for line in collect_lines(&col_cmt_result) {
        ddl.push_str(&line);
        ddl.push('\n');
    }

    Ok(ddl.trim_end().to_string())
}

async fn generate_view_ddl(client: &Client, schema: &str, view: &str) -> Result<String, AppError> {
    let sql = format!(
        r#"SELECT 'CREATE OR REPLACE VIEW "{schema}"."{view}" AS' || E'\n' || pg_get_viewdef('"{schema}"."{view}"'::regclass, true) || ';'"#
    );
    let result = client
        .simple_query(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for msg in &result {
        if let SimpleQueryMessage::Row(row) = msg {
            return Ok(row.get(0).unwrap_or("").to_string());
        }
    }
    Ok(String::new())
}

async fn generate_matview_ddl(
    client: &Client,
    schema: &str,
    matview: &str,
) -> Result<String, AppError> {
    let sql = format!(
        r#"SELECT 'CREATE MATERIALIZED VIEW "{schema}"."{matview}" AS' || E'\n' || definition
           FROM pg_matviews
           WHERE schemaname = '{schema}' AND matviewname = '{matview}'"#
    );
    let result = client
        .simple_query(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let mut ddl = String::new();
    for msg in &result {
        if let SimpleQueryMessage::Row(row) = msg {
            ddl = row.get(0).unwrap_or("").to_string();
        }
    }

    let idx_sql = format!(
        r#"SELECT pg_get_indexdef(i.indexrelid) || ';'
           FROM pg_index i
           JOIN pg_class tbl ON tbl.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = tbl.relnamespace
           WHERE n.nspname = '{schema}' AND tbl.relname = '{matview}'"#
    );
    let idx_result = client
        .simple_query(&idx_sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for msg in &idx_result {
        if let SimpleQueryMessage::Row(row) = msg
            && let Some(line) = row.get(0)
        {
            ddl.push('\n');
            ddl.push_str(line);
        }
    }

    Ok(ddl.trim_end().to_string())
}

async fn generate_function_ddl(
    client: &Client,
    schema: &str,
    func_name: &str,
) -> Result<String, AppError> {
    let sql = format!(
        r#"SELECT pg_get_functiondef(p.oid)
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = '{schema}' AND p.proname = '{func_name}'
           LIMIT 1"#
    );
    let result = client
        .simple_query(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    for msg in &result {
        if let SimpleQueryMessage::Row(row) = msg {
            return Ok(row.get(0).unwrap_or("").to_string());
        }
    }
    Ok(String::new())
}
