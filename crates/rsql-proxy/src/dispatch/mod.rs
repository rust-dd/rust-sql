pub mod pgsql_meta;
mod pgsql_meta_admin;
mod pgsql_meta_connection;
mod pgsql_meta_metadata;
mod pgsql_meta_objects;
mod pgsql_meta_statistics;
pub mod pgsql_pubsub;
pub mod pgsql_query;
pub mod state_cmds;
pub mod terminal_cmds;
pub mod utils_cmds;

use uuid::Uuid;

use crate::protocol::{Outbound, Request};
use crate::session::ProxySession;

pub async fn dispatch(session: &ProxySession, req: Request) -> Outbound {
    let Request { id, cmd, payload } = req;
    let result = route(session, &cmd, payload, id).await;
    match result {
        Ok(out) => out,
        Err(message) => Outbound::error(id, message),
    }
}

async fn route(
    session: &ProxySession,
    cmd: &str,
    payload: serde_json::Value,
    id: Uuid,
) -> Result<Outbound, String> {
    match cmd {
        "project_db_select" | "project_db_insert" | "project_db_delete" | "query_db_select"
        | "query_db_insert" | "query_db_delete" | "workspace_save" | "workspace_load_all"
        | "workspace_delete" => state_cmds::handle(session, cmd, payload, id).await,
        "system_resource_usage" | "compute_diff" => {
            utils_cmds::handle(session, cmd, payload, id).await
        }
        "pgsql_run_query"
        | "pgsql_run_query_packed"
        | "pgsql_execute_virtual"
        | "pgsql_fetch_page"
        | "pgsql_close_virtual"
        | "pgsql_cancel_query"
        | "pgsql_run_query_streamed" => pgsql_query::handle(session, cmd, payload, id).await,
        "pgsql_listen_start"
        | "pgsql_listen_stop"
        | "pgsql_notify_send"
        | "pgsql_discover_channels" => pgsql_pubsub::handle(session, cmd, payload, id).await,
        "terminal_spawn" | "terminal_write" | "terminal_resize" | "terminal_kill" => {
            terminal_cmds::handle(session, cmd, payload, id).await
        }
        c if c.starts_with("pgsql_") => pgsql_meta::handle(session, c, payload, id).await,
        _ => Err(format!("unknown command: {cmd}")),
    }
}
