use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

async fn spawn_test_server() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let app = rsql_proxy::router(None);
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    addr
}

#[tokio::test]
async fn ws_echoes_text_frame() {
    let addr = spawn_test_server().await;
    let url = format!("ws://{addr}/ws");
    let (mut stream, _) = tokio_tungstenite::connect_async(&url).await.expect("connect");

    stream.send(Message::Text("hello".into())).await.unwrap();
    let received = stream.next().await.expect("frame").expect("ok");
    assert_eq!(received, Message::Text("hello".into()));
}

#[tokio::test]
async fn ws_echoes_binary_frame() {
    let addr = spawn_test_server().await;
    let url = format!("ws://{addr}/ws");
    let (mut stream, _) = tokio_tungstenite::connect_async(&url).await.expect("connect");

    let payload = vec![0u8, 1, 2, 3, 0x1F, 0x1E, 0xFF];
    stream.send(Message::Binary(payload.clone().into())).await.unwrap();
    let received = stream.next().await.expect("frame").expect("ok");
    assert_eq!(received, Message::Binary(payload.into()));
}
