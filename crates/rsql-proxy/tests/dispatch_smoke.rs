mod common;

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use uuid::Uuid;

#[tokio::test]
async fn workspace_roundtrip_over_ws() {
    let (addr, _tmp) = common::spawn_test_server().await;
    let url = format!("ws://{addr}/ws");
    let (mut ws, _) = connect_async(url).await.unwrap();

    let save_id = Uuid::now_v7();
    let save_req = json!({
        "type": "request",
        "id": save_id.to_string(),
        "cmd": "workspace_save",
        "payload": { "name": "ws-test", "tabs": "[]" }
    });
    ws.send(Message::Text(save_req.to_string().into()))
        .await
        .unwrap();

    let resp = next_text(&mut ws).await;
    assert_eq!(resp["type"], "response");
    assert_eq!(resp["id"], save_id.to_string());

    let load_id = Uuid::now_v7();
    let load_req = json!({
        "type": "request",
        "id": load_id.to_string(),
        "cmd": "workspace_load_all",
        "payload": {}
    });
    ws.send(Message::Text(load_req.to_string().into()))
        .await
        .unwrap();

    let resp = next_text(&mut ws).await;
    assert_eq!(resp["type"], "response");
    let arr = resp["payload"].as_array().unwrap();
    assert!(arr.iter().any(|t| t[0] == "ws-test" && t[1] == "[]"));
}

async fn next_text<S>(ws: &mut S) -> serde_json::Value
where
    S: StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    loop {
        match ws.next().await.unwrap().unwrap() {
            Message::Text(t) => return serde_json::from_str(&t).unwrap(),
            Message::Ping(_) | Message::Pong(_) => continue,
            other => panic!("unexpected: {other:?}"),
        }
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn terminal_spawn_returns_error_when_disabled_env_set() {
    unsafe {
        std::env::set_var("RSQL_DISABLE_TERMINAL", "1");
    }
    use rsql_proxy::dispatch::terminal_cmds::is_terminal_disabled;
    assert!(
        is_terminal_disabled(),
        "RSQL_DISABLE_TERMINAL=1 must be honored"
    );
    unsafe {
        std::env::remove_var("RSQL_DISABLE_TERMINAL");
    }
}
