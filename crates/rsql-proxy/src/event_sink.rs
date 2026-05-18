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

impl EventSink for ProxyEventSink {
    fn emit<T: serde::Serialize>(&self, event: &str, payload: &T) {
        let value = match serde_json::to_value(payload) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(error = %e, event, "ProxyEventSink serialize failed");
                return;
            }
        };
        if let Err(e) = self.tx.send(Outbound::event(event, value)) {
            tracing::debug!(error = %e, "ProxyEventSink: receiver closed");
        }
    }
}
