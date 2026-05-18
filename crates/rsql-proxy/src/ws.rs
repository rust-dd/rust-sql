use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use futures_util::StreamExt;

pub fn routes() -> Router {
    Router::new().route("/ws", get(upgrade))
}

async fn upgrade(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(echo_loop)
}

async fn echo_loop(mut socket: WebSocket) {
    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                if socket.send(Message::Text(t)).await.is_err() {
                    break;
                }
            }
            Message::Binary(b) => {
                if socket.send(Message::Binary(b)).await.is_err() {
                    break;
                }
            }
            Message::Close(_) => break,
            // Ping/Pong: axum handles automatically.
            _ => {}
        }
    }
}
