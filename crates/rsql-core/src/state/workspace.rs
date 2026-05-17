use crate::error::AppError;

pub async fn workspace_save(
    local_db: &libsql::Database,
    name: &str,
    tabs: &str,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "INSERT OR REPLACE INTO workspaces (name, tabs) VALUES (?1, ?2)",
        libsql::params![name, tabs],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

pub async fn workspace_load_all(
    local_db: &libsql::Database,
) -> Result<Vec<(String, String)>, AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query("SELECT name, tabs FROM workspaces ORDER BY name", ())
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut workspaces = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let name: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let tabs: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        workspaces.push((name, tabs));
    }
    Ok(workspaces)
}

pub async fn workspace_delete(
    local_db: &libsql::Database,
    name: &str,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM workspaces WHERE name = ?1",
        libsql::params![name],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
