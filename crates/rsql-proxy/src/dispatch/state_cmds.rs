use rsql_core::state::{project, query, workspace};
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
    let db = &session.app_state.local_db;
    let json_resp = |value: serde_json::Value| Ok(Outbound::response(id, value));

    match cmd {
        "project_db_select" => {
            let v = project::project_db_select(db).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }
        "project_db_insert" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                project_details: Vec<String>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            project::project_db_insert(db, &a.project_id, a.project_details)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::Value::Null)
        }
        "project_db_delete" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            project::project_db_delete(db, &a.project_id)
                .await
                .map_err(stringify)?;
            session.app_state.clients.lock().await.remove(&a.project_id);
            session
                .app_state
                .meta_clients
                .lock()
                .await
                .remove(&a.project_id);
            session
                .app_state
                .cancel_tokens
                .lock()
                .await
                .remove(&a.project_id);
            session
                .app_state
                .client_ssl
                .lock()
                .await
                .remove(&a.project_id);
            json_resp(serde_json::Value::Null)
        }
        "query_db_select" => {
            let v = query::query_db_select(db).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }
        "query_db_insert" => {
            #[derive(Deserialize)]
            struct Args {
                query_id: String,
                sql: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            query::query_db_insert(db, &a.query_id, &a.sql)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::Value::Null)
        }
        "query_db_delete" => {
            #[derive(Deserialize)]
            struct Args {
                query_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            query::query_db_delete(db, &a.query_id)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::Value::Null)
        }
        "workspace_save" => {
            #[derive(Deserialize)]
            struct Args {
                name: String,
                tabs: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            workspace::workspace_save(db, &a.name, &a.tabs)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::Value::Null)
        }
        "workspace_load_all" => {
            let v = workspace::workspace_load_all(db).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }
        "workspace_delete" => {
            #[derive(Deserialize)]
            struct Args {
                name: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            workspace::workspace_delete(db, &a.name)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::Value::Null)
        }
        _ => Err(format!("state_cmds: unknown command: {cmd}")),
    }
}

fn stringify(e: rsql_core::error::AppError) -> String {
    e.to_string()
}
