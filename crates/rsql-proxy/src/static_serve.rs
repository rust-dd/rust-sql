use axum::Router;
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};

pub fn routes(dist_dir: PathBuf) -> Router {
    let index = dist_dir.join("index.html");
    let serve_dir = ServeDir::new(&dist_dir).fallback(ServeFile::new(&index));
    Router::new().fallback_service(serve_dir)
}
