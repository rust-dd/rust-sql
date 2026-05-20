use clap::Parser;
use rsql_proxy::ProxyConfig;
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[derive(Parser, Debug)]
#[command(
    name = "rsql-proxy",
    version,
    about = "rsql-proxy: WebSocket bridge for browser/hosted RSQL"
)]
struct Args {
    #[arg(long, env = "RSQL_BIND", default_value = "127.0.0.1:8080")]
    addr: SocketAddr,
    #[arg(long, env = "RSQL_DIST_DIR", default_value = "dist")]
    dist_dir: String,
    #[arg(long, env = "RSQL_STATE_PATH", default_value = "proxy.db")]
    state_path: String,
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

    let app_state = rsql_core::state::bootstrap(&args.state_path)
        .await
        .expect("AppState bootstrap failed");
    let app_state = Arc::new(app_state);

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        addr = %listener.local_addr().unwrap(),
        dist = %args.dist_dir,
        state = %args.state_path,
        "rsql-proxy listening"
    );

    let config = ProxyConfig {
        app_state,
        dist_dir: Some(PathBuf::from(args.dist_dir)),
    };

    axum::serve(listener, rsql_proxy::router(config))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("axum::serve failed");
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c().await.expect("ctrl-c handler");
    tracing::info!("shutdown signal received");
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    fn parse_clean() -> Args {
        Args::try_parse_from(["rsql-proxy"]).unwrap()
    }

    #[test]
    fn defaults_apply_when_no_env() {
        unsafe {
            std::env::remove_var("RSQL_BIND");
            std::env::remove_var("RSQL_DIST_DIR");
            std::env::remove_var("RSQL_STATE_PATH");
        }
        let args = parse_clean();
        assert_eq!(args.addr.to_string(), "127.0.0.1:8080");
        assert_eq!(args.dist_dir, "dist");
        assert_eq!(args.state_path, "proxy.db");
    }

    #[test]
    fn env_overrides_default() {
        unsafe {
            std::env::set_var("RSQL_BIND", "0.0.0.0:9999");
            std::env::set_var("RSQL_DIST_DIR", "/srv/dist");
            std::env::set_var("RSQL_STATE_PATH", "/data/rsql.db");
        }
        let args = parse_clean();
        assert_eq!(args.addr.to_string(), "0.0.0.0:9999");
        assert_eq!(args.dist_dir, "/srv/dist");
        assert_eq!(args.state_path, "/data/rsql.db");
        unsafe {
            std::env::remove_var("RSQL_BIND");
            std::env::remove_var("RSQL_DIST_DIR");
            std::env::remove_var("RSQL_STATE_PATH");
        }
    }

    #[test]
    fn cli_arg_beats_env() {
        unsafe {
            std::env::set_var("RSQL_BIND", "0.0.0.0:9999");
        }
        let args = Args::try_parse_from(["rsql-proxy", "--addr", "127.0.0.1:7000"]).unwrap();
        assert_eq!(args.addr.to_string(), "127.0.0.1:7000");
        unsafe {
            std::env::remove_var("RSQL_BIND");
        }
    }
}
