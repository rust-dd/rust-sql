use crate::AppState;
use crate::common::BTreeVecStore;
use crate::common::enums::AppError;
use libsql::Connection;
use std::collections::BTreeMap;
use tauri::{Result, State};

/// Column order of the details vector exchanged with the frontend.
/// `select_projects` appends `legacy_id`, which only the id migration writes.
const DETAIL_COLUMNS: [&str; 14] = [
    "driver",
    "username",
    "password",
    "database",
    "host",
    "port",
    "ssl",
    "ssh_enabled",
    "ssh_host",
    "ssh_port",
    "ssh_user",
    "ssh_password",
    "ssh_key_path",
    "name",
];

#[cfg(test)]
mod tests;

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_select(app_state: State<'_, AppState>) -> Result<BTreeVecStore> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(select_projects(&conn)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_insert(
    project_id: &str,
    project_details: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<()> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    upsert_project(&conn, project_id, &project_details)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

pub(crate) async fn select_projects(conn: &Connection) -> libsql::Result<BTreeVecStore> {
    let sql = format!(
        "SELECT id, {}, legacy_id FROM projects ORDER BY id",
        DETAIL_COLUMNS.join(", ")
    );
    let mut rows = conn.query(&sql, ()).await?;

    let mut projects = BTreeMap::new();
    while let Some(row) = rows.next().await? {
        let id: String = row.get(0)?;
        let mut details = Vec::with_capacity(DETAIL_COLUMNS.len() + 1);
        for idx in 1..=DETAIL_COLUMNS.len() as i32 + 1 {
            details.push(row.get::<String>(idx)?);
        }
        projects.insert(id, details);
    }
    Ok(projects)
}

pub(crate) async fn upsert_project(
    conn: &Connection,
    project_id: &str,
    details: &[String],
) -> libsql::Result<()> {
    let placeholders: Vec<String> = (1..=DETAIL_COLUMNS.len() + 1)
        .map(|idx| format!("?{idx}"))
        .collect();
    let updates: Vec<String> = DETAIL_COLUMNS
        .iter()
        .map(|column| format!("{column} = excluded.{column}"))
        .collect();
    let sql = format!(
        "INSERT INTO projects (id, {}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {}",
        DETAIL_COLUMNS.join(", "),
        placeholders.join(", "),
        updates.join(", ")
    );
    let mut values = vec![project_id.to_string()];
    for (idx, column) in DETAIL_COLUMNS.iter().enumerate() {
        let fallback = if *column == "ssl" { "false" } else { "" };
        values.push(
            details
                .get(idx)
                .map_or(fallback, String::as_str)
                .to_string(),
        );
    }
    conn.execute(&sql, libsql::params_from_iter(values)).await?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn project_db_delete(project_id: &str, app_state: State<'_, AppState>) -> Result<()> {
    let conn = app_state
        .local_db
        .connect()
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    conn.execute(
        "DELETE FROM projects WHERE id = ?1",
        libsql::params![project_id],
    )
    .await
    .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    // Best-effort cleanup for in-memory connection state.
    app_state.clients.lock().await.remove(project_id);
    app_state.meta_clients.lock().await.remove(project_id);
    app_state.client_ssl.lock().await.remove(project_id);

    app_state.executions.cancel_project(project_id);

    // A LISTEN task and an SSH tunnel outlive the project otherwise: the task
    // keeps polling a connection that is gone, and the tunnel holds its port.
    // Listener handles are keyed "<project>:<channel>", so every channel of
    // this project has to go.
    {
        let mut handles = app_state.notify_handles.lock().await;
        let prefix = format!("{}:", project_id);
        let owned: Vec<String> = handles
            .keys()
            .filter(|key| key.starts_with(&prefix))
            .cloned()
            .collect();
        for key in owned {
            if let Some(handle) = handles.remove(&key) {
                handle.abort();
            }
        }
    }
    app_state.ssh_tunnels.lock().await.remove(project_id);

    Ok(())
}
