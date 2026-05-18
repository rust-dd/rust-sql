use rsql_core::AppState;
use rsql_core::drivers::pgsql::commands::pubsub;
use rsql_core::error::AppError;
use tauri::{AppHandle, Manager, State};

use crate::event_sink::TauriEventSink;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_listen_start(
    project_id: &str,
    channel: &str,
    app: AppHandle,
) -> Result<bool, AppError> {
    let app_state = app.state::<AppState>();
    let sink: rsql_core::events::SharedEventSink = TauriEventSink::new(app.clone());
    pubsub::listen_start(app_state.inner(), project_id, channel, sink).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_listen_stop(
    project_id: &str,
    channel: &str,
    app_state: State<'_, AppState>,
) -> Result<bool, AppError> {
    pubsub::listen_stop(app_state.inner(), project_id, channel).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_notify_send(
    project_id: &str,
    channel: &str,
    payload: &str,
    app_state: State<'_, AppState>,
) -> Result<bool, AppError> {
    pubsub::pgsql_notify_send(app_state.inner(), project_id, channel, payload).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_discover_channels(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    pubsub::pgsql_discover_channels(app_state.inner(), project_id).await
}
