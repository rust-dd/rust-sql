use rsql_core::drivers::pgsql::commands::pubsub;
use rsql_core::error::AppError;
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
    let state = session.app_state.as_ref();

    match cmd {
        "pgsql_listen_start" => {
            #[derive(Deserialize)]
            struct Args { project_id: String, channel: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = pubsub::listen_start(state, &a.project_id, &a.channel, session.sink.clone())
                .await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Bool(v)))
        }
        "pgsql_listen_stop" => {
            #[derive(Deserialize)]
            struct Args { project_id: String, channel: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = pubsub::listen_stop(state, &a.project_id, &a.channel)
                .await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Bool(v)))
        }
        "pgsql_notify_send" => {
            #[derive(Deserialize)]
            struct Args { project_id: String, channel: String, payload: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = pubsub::pgsql_notify_send(state, &a.project_id, &a.channel, &a.payload)
                .await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Bool(v)))
        }
        "pgsql_discover_channels" => {
            #[derive(Deserialize)]
            struct Args { project_id: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = pubsub::pgsql_discover_channels(state, &a.project_id)
                .await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::to_value(v).map_err(|e| e.to_string())?))
        }
        _ => Err(format!("pgsql_pubsub: unknown command: {cmd}")),
    }
}

fn stringify(e: AppError) -> String { e.to_string() }
