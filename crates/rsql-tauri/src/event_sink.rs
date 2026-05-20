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

impl EventSink for TauriEventSink {
    fn emit<T: serde::Serialize>(&self, event: &str, payload: &T) {
        if let Err(e) = self.app.emit(event, payload) {
            tracing::warn!(event, error = %e, "TauriEventSink emit failed");
        }
    }
}
