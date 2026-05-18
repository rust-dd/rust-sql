use rsql_core::drivers::pgsql::commands::statistics;
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
    let json_resp = |value: serde_json::Value| Ok(Outbound::response(id, value));

    macro_rules! call_pid_only {
        ($fn:ident) => {{
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = statistics::$fn(state, &a.project_id).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }};
    }

    match cmd {
        "pgsql_load_activity" => call_pid_only!(pgsql_load_activity),
        "pgsql_load_database_stats" => call_pid_only!(pgsql_load_database_stats),
        "pgsql_load_table_stats" => call_pid_only!(pgsql_load_table_stats),
        "pgsql_load_locks" => call_pid_only!(pgsql_load_locks),
        "pgsql_load_index_usage" => call_pid_only!(pgsql_load_index_usage),
        "pgsql_load_table_bloat" => call_pid_only!(pgsql_load_table_bloat),

        "pgsql_load_foreign_keys" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = statistics::pgsql_load_foreign_keys(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_table_statistics" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = statistics::pgsql_table_statistics(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_fk_details" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
                direction: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = statistics::pgsql_fk_details(
                state,
                &a.project_id,
                &a.schema,
                &a.table,
                &a.direction,
            )
            .await
            .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        _ => unreachable!("pgsql_meta_statistics: unexpected command {cmd}"),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
