use axum::{
    Router,
    extract::{State, WebSocketUpgrade, ws::{Message, WebSocket}},
    response::IntoResponse,
    routing::get,
};
use futures_util::StreamExt;
use rsql_core::AppState;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{Instant, interval, sleep_until};

use crate::dispatch::dispatch;
use crate::protocol::{self, Inbound, Outbound};
use crate::session::ProxySession;

#[derive(Clone)]
pub struct WsState {
    pub app_state: Arc<AppState>,
}

pub fn routes(state: WsState) -> Router {
    Router::new().route("/ws", get(upgrade)).with_state(state)
}

async fn upgrade(ws: WebSocketUpgrade, State(state): State<WsState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| run(socket, state.app_state))
}

async fn run(socket: WebSocket, app_state: Arc<AppState>) {
    let (outbound_tx, mut outbound_rx) = mpsc::unbounded_channel::<Outbound>();
    let session = ProxySession::new(app_state, outbound_tx.clone());

    let (mut sender, mut receiver) = socket.split();

    let (ping_tx, mut ping_rx) = mpsc::unbounded_channel::<Vec<u8>>();
    let writer = tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(msg) = outbound_rx.recv() => {
                    match msg.into_ws_message() {
                        Ok(ws_msg) => {
                            if futures_util::SinkExt::send(&mut sender, ws_msg).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => tracing::warn!(error = %e, "encode outbound failed"),
                    }
                }
                Some(payload) = ping_rx.recv() => {
                    if futures_util::SinkExt::send(&mut sender, Message::Ping(payload.into())).await.is_err() {
                        break;
                    }
                }
                else => break,
            }
        }
    });

    let mut ping_timer = interval(Duration::from_secs(30));
    ping_timer.tick().await;
    let mut pong_deadline: Option<Instant> = None;

    loop {
        tokio::select! {
            biased;
            _ = ping_timer.tick() => {
                let payload = b"rsql".to_vec();
                if ping_tx.send(payload).is_err() {
                    break;
                }
                pong_deadline = Some(Instant::now() + Duration::from_secs(10));
            }
            _ = async {
                if let Some(d) = pong_deadline {
                    sleep_until(d).await;
                } else {
                    futures_util::future::pending::<()>().await;
                }
            }, if pong_deadline.is_some() => {
                tracing::info!("WS pong deadline missed, closing");
                break;
            }
            maybe_msg = receiver.next() => {
                let Some(Ok(msg)) = maybe_msg else { break };
                match msg {
                    Message::Text(t) => match protocol::parse_text(&t) {
                        Ok(Inbound::Request(req)) => {
                            let session_clone = session.clone();
                            let tx_clone = outbound_tx.clone();
                            tokio::spawn(async move {
                                let out = dispatch(&session_clone, req).await;
                                let _ = tx_clone.send(out);
                            });
                        }
                        Ok(Inbound::Cancel(c)) => {
                            let session_clone = session.clone();
                            tokio::spawn(async move { session_clone.trip_cancel(c.id).await; });
                        }
                        Ok(Inbound::BinaryChunk { .. }) => {}
                        Err(e) => tracing::warn!(error = %e, "ignored malformed JSON frame"),
                    },
                    Message::Binary(_b) => {}
                    Message::Pong(_) => { pong_deadline = None; }
                    Message::Ping(_) => {}
                    Message::Close(_) => break,
                }
            }
        }
    }

    session.cleanup().await;
    drop(outbound_tx);
    drop(ping_tx);
    let _ = writer.await;
}
