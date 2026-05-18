use axum::{Json, Router, routing::get};
use serde_json::{Value, json};

pub fn routes() -> Router {
    Router::new().route("/health", get(handler))
}

async fn handler() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
