use crate::error::AppError;
use std::collections::BTreeMap;

pub async fn query_db_select(
    local_db: &libsql::Database,
) -> Result<BTreeMap<String, String>, AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query("SELECT id, sql FROM queries ORDER BY id", ())
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut queries = BTreeMap::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let id: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let sql: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        queries.insert(id, sql);
    }
    Ok(queries)
}

pub async fn query_db_insert(
    local_db: &libsql::Database,
    query_id: &str,
    sql: &str,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "INSERT OR REPLACE INTO queries (id, sql) VALUES (?1, ?2)",
        libsql::params![query_id, sql],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

pub async fn query_db_delete(
    local_db: &libsql::Database,
    query_id: &str,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM queries WHERE id = ?1",
        libsql::params![query_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
