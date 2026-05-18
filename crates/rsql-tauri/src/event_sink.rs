use rsql_core::events::EventSink;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self { app })
    }
}

#[async_trait::async_trait]
impl EventSink for TauriEventSink {
    async fn emit_json(&self, event: &str, payload: serde_json::Value) {
        if let Err(e) = self.app.emit(event, payload) {
            tracing::warn!(event, error = %e, "TauriEventSink emit failed");
        }
    }
}
