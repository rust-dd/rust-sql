use rsql_core::drivers::pgsql::commands::metadata;
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
            let v = metadata::$fn(state, &a.project_id).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }};
    }

    match cmd {
        "pgsql_load_databases" => call_pid_only!(pgsql_load_databases),
        "pgsql_load_tablespaces" => call_pid_only!(pgsql_load_tablespaces),
        "pgsql_load_schemas" => call_pid_only!(pgsql_load_schemas),

        "pgsql_load_tables" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_tables(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_columns" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_columns(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_column_details" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_column_details(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_indexes" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_indexes(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_constraints" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_constraints(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_triggers" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_triggers(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_rules" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_rules(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_policies" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
                table: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_policies(state, &a.project_id, &a.schema, &a.table)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_views" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_views(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_materialized_views" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_materialized_views(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_functions" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_functions(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_trigger_functions" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = metadata::pgsql_load_trigger_functions(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        _ => unreachable!("pgsql_meta_metadata: unexpected command {cmd}"),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
