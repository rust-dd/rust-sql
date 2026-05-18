//! rsql-proxy: WebSocket bridge for browser/hosted RSQL.

pub mod dispatch;
pub mod event_sink;
pub mod health;
pub mod protocol;
pub mod session;
pub mod static_serve;
pub mod ws;

use axum::Router;
use rsql_core::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::trace::TraceLayer;

pub struct ProxyConfig {
    pub app_state: Arc<AppState>,
    pub dist_dir: Option<PathBuf>,
}

pub fn router(config: ProxyConfig) -> Router {
    let ws_state = ws::WsState { app_state: config.app_state };
    let mut app = Router::new()
        .merge(health::routes())
        .merge(ws::routes(ws_state));

    if let Some(dir) = config.dist_dir {
        app = app.merge(static_serve::routes(dir));
    }

    app.layer(TraceLayer::new_for_http())
}
