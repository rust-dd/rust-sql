use rsql_core::drivers::pgsql::commands::connection;
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
        "pgsql_test_connection" => {
            #[derive(Deserialize)]
            struct Args {
                key: Vec<String>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            if a.key.len() != 6 {
                return Err(format!(
                    "pgsql_test_connection: key must have 6 elements, got {}",
                    a.key.len()
                ));
            }
            let key: [&str; 6] = [
                &a.key[0], &a.key[1], &a.key[2], &a.key[3], &a.key[4], &a.key[5],
            ];
            let v = connection::pgsql_test_connection(key).await.map_err(stringify)?;
            json_resp(serde_json::Value::String(v))
        }

        "pgsql_connector" => {
            #[derive(Deserialize)]
            struct Args {
                project_id: String,
                key: Option<Vec<String>>,
                ssh: Option<Vec<String>>,
            }
            let a: Args = serde_json::from_value(payload).map_err(|e| e.to_string())?;
            let key: Option<[String; 6]> = match a.key {
                None => None,
                Some(v) => {
                    if v.len() != 6 {
                        return Err(format!(
                            "pgsql_connector: key must have 6 elements, got {}",
                            v.len()
                        ));
                    }
                    Some([
                        v[0].clone(),
                        v[1].clone(),
                        v[2].clone(),
                        v[3].clone(),
                        v[4].clone(),
                        v[5].clone(),
                    ])
                }
            };
            let key_ref: Option<[&str; 6]> = key.as_ref().map(|k| {
                [
                    k[0].as_str(),
                    k[1].as_str(),
                    k[2].as_str(),
                    k[3].as_str(),
                    k[4].as_str(),
                    k[5].as_str(),
                ]
            });
            let v = connection::pgsql_connector(state, &a.project_id, key_ref, a.ssh)
                .await
                .map_err(stringify)?;
            json_resp(serde_json::to_value(v).map_err(|e| e.to_string())?)
        }

        _ => unreachable!("pgsql_meta_connection: unexpected command {cmd}"),
    }
}

fn stringify(e: AppError) -> String {
    e.to_string()
}
