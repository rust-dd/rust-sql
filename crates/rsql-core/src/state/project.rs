use crate::common::BTreeVecStore;
use crate::error::AppError;
use std::collections::BTreeMap;

pub async fn project_db_select(local_db: &libsql::Database) -> Result<BTreeVecStore, AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut rows = conn
        .query(
            "SELECT id, driver, username, password, database, host, port, ssl, ssh_enabled, ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_path FROM projects ORDER BY id",
            (),
        )
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let mut projects = BTreeMap::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
    {
        let id: String = row
            .get(0)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let driver: String = row
            .get(1)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let username: String = row
            .get(2)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let password: String = row
            .get(3)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let database: String = row
            .get(4)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let host: String = row
            .get(5)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let port: String = row
            .get(6)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let ssl: String = row
            .get(7)
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        let ssh_enabled: String = row.get::<String>(8).unwrap_or_default();
        let ssh_host: String = row.get::<String>(9).unwrap_or_default();
        let ssh_port: String = row.get::<String>(10).unwrap_or_default();
        let ssh_user: String = row.get::<String>(11).unwrap_or_default();
        let ssh_password: String = row.get::<String>(12).unwrap_or_default();
        let ssh_key_path: String = row.get::<String>(13).unwrap_or_default();
        projects.insert(
            id,
            vec![
                driver,
                username,
                password,
                database,
                host,
                port,
                ssl,
                ssh_enabled,
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key_path,
            ],
        );
    }
    Ok(projects)
}

pub async fn project_db_insert(
    local_db: &libsql::Database,
    project_id: &str,
    project_details: Vec<String>,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let driver = project_details.first().cloned().unwrap_or_default();
    let username = project_details.get(1).cloned().unwrap_or_default();
    let password = project_details.get(2).cloned().unwrap_or_default();
    let database = project_details.get(3).cloned().unwrap_or_default();
    let host = project_details.get(4).cloned().unwrap_or_default();
    let port = project_details.get(5).cloned().unwrap_or_default();
    let ssl = project_details
        .get(6)
        .cloned()
        .unwrap_or("false".to_string());
    let ssh_enabled = project_details.get(7).cloned().unwrap_or_default();
    let ssh_host = project_details.get(8).cloned().unwrap_or_default();
    let ssh_port = project_details.get(9).cloned().unwrap_or_default();
    let ssh_user = project_details.get(10).cloned().unwrap_or_default();
    let ssh_password = project_details.get(11).cloned().unwrap_or_default();
    let ssh_key_path = project_details.get(12).cloned().unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO projects (id, driver, username, password, database, host, port, ssl, ssh_enabled, ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        libsql::params![project_id, driver, username, password, database, host, port, ssl, ssh_enabled, ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_path],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}

pub async fn project_db_delete(
    local_db: &libsql::Database,
    project_id: &str,
) -> Result<(), AppError> {
    let conn = local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM projects WHERE id = ?1",
        libsql::params![project_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM virtual_query_pages
         WHERE query_id IN (
             SELECT query_id FROM virtual_query_snapshots WHERE project_id = ?1
         )",
        libsql::params![project_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    conn.execute(
        "DELETE FROM virtual_query_snapshots WHERE project_id = ?1",
        libsql::params![project_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    Ok(())
}
