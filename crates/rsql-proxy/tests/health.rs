mod common;

#[tokio::test]
async fn health_returns_ok_with_version() {
    let (addr, _tmp) = common::spawn_test_server().await;
    let url = format!("http://{addr}/health");
    let resp: serde_json::Value = reqwest::get(&url).await.unwrap().json().await.unwrap();
    assert_eq!(resp["status"], "ok");
    assert!(resp["version"].is_string());
}
