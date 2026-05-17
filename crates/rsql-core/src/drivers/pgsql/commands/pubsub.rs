use crate::AppState;
use crate::drivers::pgsql::roles_schema_objects::discover_notify_channels;
use crate::error::AppError;

use super::pool_helpers::acquire_client;

pub async fn pgsql_notify_send(
    app_state: &AppState,
    project_id: &str,
    channel: &str,
    payload: &str,
) -> Result<bool, AppError> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    let sql = format!(
        "SELECT pg_notify('{}', '{}')",
        channel.replace('\'', "''"),
        payload.replace('\'', "''"),
    );
    client
        .batch_execute(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(true)
}

pub async fn pgsql_discover_channels(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<String>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    discover_notify_channels(&client).await
}
