use serde::Serialize;
use std::sync::Arc;

#[async_trait::async_trait]
pub trait EventSink: Send + Sync + 'static {
    async fn emit_json(&self, event: &str, payload: serde_json::Value);
}

pub type SharedEventSink = Arc<dyn EventSink>;

pub async fn emit_typed<T: Serialize>(sink: &SharedEventSink, event: &str, payload: &T) {
    match serde_json::to_value(payload) {
        Ok(v) => sink.emit_json(event, v).await,
        Err(e) => tracing::error!(error = %e, event, "emit_typed: serialize failed"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::Mutex;

    struct RecordingSink(Arc<Mutex<Vec<(String, serde_json::Value)>>>);

    #[async_trait::async_trait]
    impl EventSink for RecordingSink {
        async fn emit_json(&self, event: &str, payload: serde_json::Value) {
            self.0.lock().await.push((event.to_string(), payload));
        }
    }

    #[tokio::test]
    async fn emit_typed_serializes_and_forwards() {
        #[derive(serde::Serialize)]
        struct Probe { n: u32, label: &'static str }

        let log = Arc::new(Mutex::new(Vec::new()));
        let sink: SharedEventSink = Arc::new(RecordingSink(log.clone()));

        emit_typed(&sink, "probe", &Probe { n: 7, label: "hi" }).await;

        let recorded = log.lock().await;
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0].0, "probe");
        assert_eq!(recorded[0].1, serde_json::json!({"n": 7, "label": "hi"}));
    }
}
