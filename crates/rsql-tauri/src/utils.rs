use rsql_core::AppState;
use rsql_core::utils::{SystemResourceUsage, pool_stats};
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub async fn system_resource_usage(
    app_state: State<'_, AppState>,
) -> Result<SystemResourceUsage, String> {
    let mut usage = {
        let mut monitor = app_state.resource_monitor.lock().await;
        monitor.sample()
    };

    let (q_open, q_available, q_max, q_waiting) = pool_stats(&app_state.clients).await;
    let (m_open, m_available, m_max, m_waiting) = pool_stats(&app_state.meta_clients).await;

    let total_open = q_open.saturating_add(m_open);
    let total_available = q_available.saturating_add(m_available);

    usage.db_connections_open = total_open;
    usage.db_connections_max = q_max.saturating_add(m_max);
    usage.db_connections_waiting = q_waiting.saturating_add(m_waiting);
    usage.db_connections_in_use = total_open.saturating_sub(total_available);

    Ok(usage)
}

#[tauri::command(rename_all = "snake_case")]
pub fn compute_diff(pinned_packed: String, current_packed: String) -> (String, String, usize) {
    rsql_core::utils::diff::compute_diff(&pinned_packed, &current_packed)
}
