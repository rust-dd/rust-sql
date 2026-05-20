use rsql_core::terminal::TerminalRegistry;
use tauri::{AppHandle, State};

use crate::event_sink::TauriEventSink;

#[tauri::command]
pub async fn terminal_spawn(
    app: AppHandle,
    terminal_state: State<'_, TerminalRegistry>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sink = TauriEventSink::new(app);
    rsql_core::terminal::spawn(terminal_state.inner(), sink, id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_write(
    terminal_state: State<'_, TerminalRegistry>,
    id: String,
    data: String,
) -> Result<(), String> {
    terminal_state
        .write(&id, data.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_resize(
    terminal_state: State<'_, TerminalRegistry>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    terminal_state
        .resize(&id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminal_kill(
    terminal_state: State<'_, TerminalRegistry>,
    id: String,
) -> Result<(), String> {
    terminal_state.kill(&id).await.map_err(|e| e.to_string())
}
