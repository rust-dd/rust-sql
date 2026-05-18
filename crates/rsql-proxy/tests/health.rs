use std::net::SocketAddr;
use tokio::net::TcpListener;

async fn spawn_test_server() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local_addr");
    let app = rsql_proxy::router(None);
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve");
    });
    // Small wait for the server to be ready
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    addr
}

#[tokio::test]
async fn health_returns_ok_with_version() {
    let addr = spawn_test_server().await;
    let url = format!("http://{addr}/health");
    let resp: serde_json::Value = reqwest::get(&url).await.unwrap().json().await.unwrap();
    assert_eq!(resp["status"], "ok");
    assert!(resp["version"].is_string());
    assert!(!resp["version"].as_str().unwrap().is_empty());
}
