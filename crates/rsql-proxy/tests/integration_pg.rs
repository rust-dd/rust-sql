//! Run manually with:
//!   RSQL_TEST_PG_KEY="user,pw,db,host,5432,false" cargo test -p rsql-proxy --test integration_pg -- --ignored

mod common;

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use uuid::Uuid;

fn pg_key() -> Option<Vec<String>> {
    std::env::var("RSQL_TEST_PG_KEY")
        .ok()
        .map(|s| s.split(',').map(|p| p.to_string()).collect())
}

#[tokio::test]
#[ignore]
async fn pgsql_run_query_binary_frame() {
    let Some(key) = pg_key() else {
        eprintln!("skipping: RSQL_TEST_PG_KEY not set");
        return;
    };
    let (addr, _tmp) = common::spawn_test_server().await;
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();

    let id = Uuid::now_v7();
    ws.send(Message::Text(json!({
        "type": "request",
        "id": id.to_string(),
        "cmd": "pgsql_connector",
        "payload": { "project_id": "p", "key": key, "ssh": null }
    }).to_string().into())).await.unwrap();
    let _ = ws.next().await;

    let id = Uuid::now_v7();
    ws.send(Message::Text(json!({
        "type": "request",
        "id": id.to_string(),
        "cmd": "pgsql_run_query_packed",
        "payload": { "project_id": "p", "sql": "SELECT 1 AS x", "timeout_ms": null }
    }).to_string().into())).await.unwrap();

    loop {
        match ws.next().await.unwrap().unwrap() {
            Message::Binary(b) => {
                assert!(b.len() > 16);
                let id_bytes: [u8; 16] = b[..16].try_into().unwrap();
                assert_eq!(Uuid::from_bytes(id_bytes), id);
                return;
            }
            Message::Text(_) | Message::Ping(_) | Message::Pong(_) => continue,
            other => panic!("unexpected: {other:?}"),
        }
    }
}
