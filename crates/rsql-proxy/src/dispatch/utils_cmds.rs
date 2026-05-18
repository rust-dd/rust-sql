use rsql_core::utils::{diff, pool_stats};
use serde::Deserialize;
use uuid::Uuid;

use crate::protocol::Outbound;
use crate::session::ProxySession;

pub async fn handle(
    session: &ProxySession,
    cmd: &str,
    payload: serde_json::Value,
    id: Uuid,
) -> Result<Outbound, String> {
    match cmd {
        "system_resource_usage" => {
            let mut usage = {
                let mut monitor = session.app_state.resource_monitor.lock().await;
                monitor.sample()
            };
            let (q_open, q_avail, q_max, q_wait) =
                pool_stats(&session.app_state.clients).await;
            let (m_open, m_avail, m_max, m_wait) =
                pool_stats(&session.app_state.meta_clients).await;
            let total_open = q_open.saturating_add(m_open);
            let total_avail = q_avail.saturating_add(m_avail);
            usage.db_connections_open = total_open;
            usage.db_connections_max = q_max.saturating_add(m_max);
            usage.db_connections_waiting = q_wait.saturating_add(m_wait);
            usage.db_connections_in_use = total_open.saturating_sub(total_avail);
            Ok(Outbound::response(
                id,
                serde_json::to_value(usage).map_err(|e| e.to_string())?,
            ))
        }
        "compute_diff" => {
            #[derive(Deserialize)]
            struct Args {
                pinned_packed: String,
                current_packed: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let (a_out, b_out, count) = diff::compute_diff(&a.pinned_packed, &a.current_packed);
            Ok(Outbound::response(
                id,
                serde_json::json!([a_out, b_out, count]),
            ))
        }
        _ => Err(format!("utils_cmds: unknown command: {cmd}")),
    }
}
