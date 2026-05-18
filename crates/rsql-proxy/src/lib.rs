//! rsql-proxy: WebSocket bridge for browser/hosted RSQL.

pub mod health;
pub mod static_serve;
pub mod ws;

use axum::Router;
use std::path::PathBuf;
use tower_http::trace::TraceLayer;

pub fn router(dist_dir: Option<&str>) -> Router {
    let mut app = Router::new()
        .merge(health::routes())
        .merge(ws::routes());

    if let Some(dir) = dist_dir {
        app = app.merge(static_serve::routes(PathBuf::from(dir)));
    }

    app.layer(TraceLayer::new_for_http())
}
