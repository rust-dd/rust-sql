use clap::Parser;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[derive(Parser, Debug)]
#[command(name = "rsql-proxy", version, about = "rsql-proxy: WebSocket bridge for browser/hosted RSQL")]
struct Args {
    #[arg(long, default_value = "127.0.0.1:8080")]
    addr: SocketAddr,

    #[arg(long, default_value = "dist")]
    dist_dir: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,rsql_proxy=debug")),
        )
        .with_target(false)
        .init();

    let listener = TcpListener::bind(args.addr)
        .await
        .expect("failed to bind listener");
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        addr = %listener.local_addr().unwrap(),
        dist = %args.dist_dir,
        "rsql-proxy listening"
    );

    let app = rsql_proxy::router(Some(&args.dist_dir));
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("axum::serve failed");
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.expect("ctrl-c handler");
    tracing::info!("shutdown signal received");
}
