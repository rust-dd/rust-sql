use rsql_core::drivers::pgsql::commands::{pool_helpers, query};
use rsql_core::drivers::pgsql::streaming::execute_query_streamed;
use rsql_core::error::AppError;
use rsql_core::events::EventSink;
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
        "pgsql_run_query" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                sql: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let s = query::pgsql_run_query(state, &a.project_id, &a.sql)
                .await
                .map_err(stringify)?;
            Ok(Outbound::binary(id, s.into_bytes()))
        }
        "pgsql_run_query_packed" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                sql: String,
                timeout_ms: Option<u32>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let s = query::pgsql_run_query_packed(state, &a.project_id, &a.sql, a.timeout_ms)
                .await
                .map_err(stringify)?;
            Ok(Outbound::binary(id, s.into_bytes()))
        }
        "pgsql_execute_virtual" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                sql: String,
                query_id: String,
                page_size: usize,
                timeout_ms: Option<u32>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let s = query::pgsql_execute_virtual(
                state,
                &a.project_id,
                &a.sql,
                &a.query_id,
                a.page_size,
                a.timeout_ms,
            )
            .await
            .map_err(stringify)?;
            Ok(Outbound::binary(id, s.into_bytes()))
        }
        "pgsql_fetch_page" => {
            #[derive(Deserialize)]
            struct Args {
                query_id: String,
                col_count: usize,
                offset: usize,
                limit: usize,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let s =
                query::pgsql_fetch_page(state, &a.query_id, a.col_count, a.offset, a.limit)
                    .await
                    .map_err(stringify)?;
            Ok(Outbound::binary(id, s.into_bytes()))
        }
        "pgsql_close_virtual" => {
            #[derive(Deserialize)]
            struct Args {
                query_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            query::pgsql_close_virtual(state, &a.query_id)
                .await
                .map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        "pgsql_cancel_query" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let v = query::pgsql_cancel_query(state, &a.project_id)
                .await
                .map_err(stringify)?;
            Ok(Outbound::response(id, serde_json::Value::Bool(v)))
        }
        "pgsql_run_query_streamed" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                sql: String,
                stream_id: String,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let client =
                pool_helpers::acquire_client(&state.clients, &a.project_id)
                    .await
                    .map_err(stringify)?;
            let token = client.cancel_token();
            pool_helpers::set_cancel_token(state, &a.project_id, token.clone())
                .await
                .map_err(stringify)?;
            session.record_cancel_token(id, token).await;

            let sink = session.sink.clone();
            let sql = a.sql.clone();
            let stream_id = a.stream_id.clone();
            tokio::spawn(async move {
                if let Err(e) = execute_query_streamed(&client, &sql, &stream_id, &sink).await {
                    let err_payload = serde_json::json!({"type": "error", "message": e.to_string()});
                    sink.emit(&format!("query-stream-{stream_id}"), &err_payload);
                }
            });
            Ok(Outbound::response(id, serde_json::Value::Null))
        }
        _ => Err(format!("pgsql_query: unknown command: {cmd}")),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
