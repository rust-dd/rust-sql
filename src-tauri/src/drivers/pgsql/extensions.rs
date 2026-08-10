use crate::common::enums::{AppError, query_failed};

pub async fn load_extensions(
    client: &deadpool_postgres::Client,
) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            "SELECT
            e.extname AS name,
            e.extversion AS installed_version,
            COALESCE(a.default_version, '') AS default_version,
            COALESCE(a.comment, '') AS comment,
            n.nspname AS schema
         FROM pg_extension e
         JOIN pg_namespace n ON n.oid = e.extnamespace
         LEFT JOIN pg_available_extensions a ON a.name = e.extname
         ORDER BY e.extname",
            &[],
        )
        .await
        .map_err(query_failed)?;

    Ok(rows
        .iter()
        .map(|r| (0..5).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}

pub async fn load_available_extensions(
    client: &deadpool_postgres::Client,
) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            "SELECT
            a.name,
            COALESCE(a.default_version, '') AS version,
            COALESCE(a.comment, '') AS comment
         FROM pg_available_extensions a
         LEFT JOIN pg_extension e ON e.extname = a.name
         WHERE e.oid IS NULL
         ORDER BY a.name",
            &[],
        )
        .await
        .map_err(query_failed)?;

    Ok(rows
        .iter()
        .map(|r| (0..3).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}

pub async fn load_enum_types(
    client: &deadpool_postgres::Client,
) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            "SELECT
            n.nspname AS schema,
            t.typname AS name,
            string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         GROUP BY n.nspname, t.typname
         ORDER BY n.nspname, t.typname",
            &[],
        )
        .await
        .map_err(query_failed)?;

    Ok(rows
        .iter()
        .map(|r| (0..3).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}

pub async fn load_pg_settings(
    client: &deadpool_postgres::Client,
) -> Result<Vec<Vec<String>>, AppError> {
    let rows = client
        .query(
            "SELECT
            name,
            COALESCE(setting, '') AS setting,
            COALESCE(unit, '') AS unit,
            category,
            COALESCE(short_desc, '') AS description,
            context,
            COALESCE(source, '') AS source,
            COALESCE(boot_val, '') AS boot_val,
            COALESCE(reset_val, '') AS reset_val
         FROM pg_settings
         ORDER BY category, name",
            &[],
        )
        .await
        .map_err(query_failed)?;

    Ok(rows
        .iter()
        .map(|r| (0..9).map(|i| r.get::<_, String>(i)).collect())
        .collect())
}
