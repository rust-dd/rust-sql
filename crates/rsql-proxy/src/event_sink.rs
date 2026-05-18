use rsql_core::events::EventSink;
use tokio::sync::mpsc::UnboundedSender;

use crate::protocol::Outbound;

pub struct ProxyEventSink {
    tx: UnboundedSender<Outbound>,
}

impl ProxyEventSink {
    pub fn new(tx: UnboundedSender<Outbound>) -> Self {
        Self { tx }
    }
}

#[async_trait::async_trait]
impl EventSink for ProxyEventSink {
    async fn emit_json(&self, event: &str, payload: serde_json::Value) {
        if let Err(e) = self.tx.send(Outbound::event(event, payload)) {
            tracing::debug!(error = %e, "ProxyEventSink: receiver closed");
        }
    }
}
