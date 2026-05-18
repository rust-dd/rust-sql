use rsql_core::AppState;
use rsql_core::events::SharedEventSink;
use rsql_core::terminal::TerminalRegistry;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::sync::mpsc::UnboundedSender;
use tokio_postgres::CancelToken;
use uuid::Uuid;

use crate::event_sink::ProxyEventSink;
use crate::protocol::Outbound;

#[derive(Clone)]
pub struct ProxySession {
    pub app_state: Arc<AppState>,
    pub terminals: TerminalRegistry,
    pub sink: SharedEventSink,
    pub outbound: UnboundedSender<Outbound>,
    pub cancel_tokens: Arc<Mutex<HashMap<Uuid, CancelToken>>>,
}

impl ProxySession {
    pub fn new(app_state: Arc<AppState>, outbound: UnboundedSender<Outbound>) -> Self {
        let sink: SharedEventSink = Arc::new(ProxyEventSink::new(outbound.clone()));
        Self {
            app_state,
            terminals: TerminalRegistry::new(),
            sink,
            outbound,
            cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn record_cancel_token(&self, id: Uuid, token: CancelToken) {
        self.cancel_tokens.lock().await.insert(id, token);
    }

    pub async fn trip_cancel(&self, id: Uuid) {
        if let Some(token) = self.cancel_tokens.lock().await.remove(&id) {
            let _ = token.cancel_query(tokio_postgres::NoTls).await;
        }
    }

    pub async fn cleanup(&self) {
        self.terminals.drain_all().await;
        {
            let mut handles = self.app_state.notify_handles.lock().await;
            let drained: Vec<_> = handles.iter().map(|(k, _)| k.clone()).collect();
            for key in drained {
                if let Some(h) = handles.remove(&key) {
                    h.abort();
                }
            }
        }
        self.cancel_tokens.lock().await.clear();
    }
}
