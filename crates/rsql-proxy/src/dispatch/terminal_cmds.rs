use rsql_core::error::AppError;
use rsql_core::terminal;
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
        "terminal_spawn" => {
            #[derive(Deserialize)]
            struct Args { id: String, cols: u16, rows: u16 }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            terminal::spawn(&session.terminals, session.sink.clone(), a.id, a.cols, a.rows)
                .await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        "terminal_write" => {
            #[derive(Deserialize)]
            struct Args { id: String, data: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            session.terminals.write(&a.id, a.data.as_bytes()).await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        "terminal_resize" => {
            #[derive(Deserialize)]
            struct Args { id: String, cols: u16, rows: u16 }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            session.terminals.resize(&a.id, a.cols, a.rows).await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        "terminal_kill" => {
            #[derive(Deserialize)]
            struct Args { id: String }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            session.terminals.kill(&a.id).await.map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        _ => Err(format!("terminal_cmds: unknown command: {cmd}")),
    }
}

fn stringify(e: AppError) -> String { e.to_string() }
