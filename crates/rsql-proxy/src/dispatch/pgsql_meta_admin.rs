use rsql_core::drivers::pgsql::commands::admin;
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
            let v = admin::$fn(state, &a.project_id).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }};
    }

    match cmd {
        "pgsql_csv_preview" => {
            #[derive(Deserialize)]
            struct Args {
                file_path: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_csv_preview(&a.file_path).await.map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_csv_import" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                file_path: String,
                schema: String,
                table: String,
                column_mapping: Vec<(usize, String)>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_csv_import(
                state,
                &a.project_id,
                &a.file_path,
                &a.schema,
                &a.table,
                a.column_mapping,
            )
            .await
            .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_roles" => call_pid_only!(pgsql_load_roles),

        "pgsql_load_table_grants" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                role_name: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_load_table_grants(state, &a.project_id, &a.role_name)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_database_grants" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                role_name: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_load_database_grants(state, &a.project_id, &a.role_name)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_extract_schema_objects" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                schema: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_extract_schema_objects(state, &a.project_id, &a.schema)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        "pgsql_load_extensions" => call_pid_only!(pgsql_load_extensions),
        "pgsql_load_available_extensions" => call_pid_only!(pgsql_load_available_extensions),
        "pgsql_load_enum_types" => call_pid_only!(pgsql_load_enum_types),

        "pgsql_table_action" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                action: String,
                schema: String,
                table: String,
                object_type: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = admin::pgsql_table_action(
                state,
                &a.project_id,
                &a.action,
                &a.schema,
                &a.table,
                &a.object_type,
            )
            .await
            .map_err(stringify)?;
            json_resp(serde_json::Value::String(v))
        }

        "pgsql_load_pg_settings" => call_pid_only!(pgsql_load_pg_settings),

        _ => unreachable!("pgsql_meta_admin: unexpected command {cmd}"),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
