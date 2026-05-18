use rsql_proxy::ProxyConfig;
use std::{net::SocketAddr, sync::Arc};
use tempfile::NamedTempFile;
use tokio::net::TcpListener;

pub async fn spawn_test_server() -> (SocketAddr, NamedTempFile) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local_addr");

    let tmp_db = NamedTempFile::new().expect("tempfile");
    let app_state = rsql_core::state::bootstrap(&tmp_db.path().to_string_lossy())
        .await
        .expect("bootstrap");
    let config = ProxyConfig {
        app_state: Arc::new(app_state),
        dist_dir: None,
    };

    tokio::spawn(async move {
        axum::serve(listener, rsql_proxy::router(config))
            .await
            .expect("serve");
    });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    (addr, tmp_db)
}
