mod common;

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use uuid::Uuid;

#[tokio::test]
async fn closing_ws_does_not_panic() {
    let (addr, _tmp) = common::spawn_test_server().await;
    let url = format!("ws://{addr}/ws");
    let (mut ws, _) = connect_async(url).await.unwrap();

    let id = Uuid::now_v7();
    let req = json!({
        "type": "request",
        "id": id.to_string(),
        "cmd": "workspace_save",
        "payload": { "name": "ephemeral", "tabs": "[]" }
    });
    ws.send(Message::Text(req.to_string().into())).await.unwrap();
    let _ = ws.next().await;

    ws.send(Message::Close(None)).await.ok();
    drop(ws);

    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let url = format!("ws://{addr}/ws");
    let (_ws2, response) = connect_async(url).await.unwrap();
    assert_eq!(response.status().as_u16(), 101);
}
