use rsql_core::drivers::pgsql::commands::object_info;
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

    match cmd {
        "pgsql_view_info" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                view: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = object_info::pgsql_view_info(state, &a.project_id, &a.schema, &a.view)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_matview_info" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                matview: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = object_info::pgsql_matview_info(state, &a.project_id, &a.schema, &a.matview)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_function_info" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                func_name: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = object_info::pgsql_function_info(state, &a.project_id, &a.schema, &a.func_name)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_generate_ddl" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                name: String,
                object_type: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = object_info::pgsql_generate_ddl(
                state,
                &a.project_id,
                &a.schema,
                &a.name,
                &a.object_type,
            )
            .await
            .map_err(stringify)?;
            json_resp(serde_json::Value::String(v))
        }

        _ => unreachable!("pgsql_meta_objects: unexpected command {cmd}"),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
