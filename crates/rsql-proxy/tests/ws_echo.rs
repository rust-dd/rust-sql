mod common;

use tokio_tungstenite::connect_async;

#[tokio::test]
async fn ws_upgrade_succeeds() {
    let (addr, _tmp) = common::spawn_test_server().await;
    let url = format!("ws://{addr}/ws");
    let (_ws, response) = connect_async(url).await.expect("connect");
    assert_eq!(response.status().as_u16(), 101);
}
