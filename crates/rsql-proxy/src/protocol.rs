use axum::extract::ws::Message;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const BINARY_ID_LEN: usize = 16;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Inbound {
    Request(Request),
    Cancel(Cancel),
    #[serde(skip)]
    BinaryChunk { id: Uuid, payload: Vec<u8> },
}

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: Uuid,
    pub cmd: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct Cancel {
    pub id: Uuid,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum OutboundFrame {
    Response {
        id: Uuid,
        payload: serde_json::Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        end: Option<bool>,
    },
    Error {
        id: Uuid,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
    Event {
        event: String,
        payload: serde_json::Value,
    },
}

#[derive(Debug, Clone)]
pub enum Outbound {
    Text(OutboundFrame),
    Binary { id: Uuid, payload: Vec<u8> },
}

impl Outbound {
    pub fn response(id: Uuid, payload: serde_json::Value) -> Self {
        Outbound::Text(OutboundFrame::Response { id, payload, end: Some(true) })
    }

    pub fn error(id: Uuid, message: impl Into<String>) -> Self {
        Outbound::Text(OutboundFrame::Error { id, message: message.into(), code: None })
    }

    pub fn event(event: impl Into<String>, payload: serde_json::Value) -> Self {
        Outbound::Text(OutboundFrame::Event { event: event.into(), payload })
    }

    pub fn binary(id: Uuid, payload: Vec<u8>) -> Self {
        Outbound::Binary { id, payload }
    }

    pub fn into_ws_message(self) -> Result<Message, serde_json::Error> {
        match self {
            Outbound::Text(frame) => Ok(Message::Text(serde_json::to_string(&frame)?.into())),
            Outbound::Binary { id, payload } => {
                let mut buf = Vec::with_capacity(BINARY_ID_LEN + payload.len());
                buf.extend_from_slice(id.as_bytes());
                buf.extend_from_slice(&payload);
                Ok(Message::Binary(buf.into()))
            }
        }
    }
}

pub fn parse_text(text: &str) -> Result<Inbound, serde_json::Error> {
    serde_json::from_str(text)
}

pub fn parse_binary(bytes: &[u8]) -> Option<(Uuid, &[u8])> {
    if bytes.len() < BINARY_ID_LEN {
        return None;
    }
    let id_bytes: [u8; 16] = bytes[..BINARY_ID_LEN].try_into().ok()?;
    let id = Uuid::from_bytes(id_bytes);
    Some((id, &bytes[BINARY_ID_LEN..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_request_text() {
        let raw = r#"{"type":"request","id":"01933e44-de63-7c80-8000-000000000000","cmd":"workspace_save","payload":{"name":"a","tabs":"[]"}}"#;
        let parsed = parse_text(raw).expect("parse");
        match parsed {
            Inbound::Request(req) => {
                assert_eq!(req.cmd, "workspace_save");
                assert_eq!(req.payload["name"], "a");
            }
            _ => panic!("expected request"),
        }
    }

    #[test]
    fn parse_cancel_text() {
        let raw = r#"{"type":"cancel","id":"01933e44-de63-7c80-8000-000000000000"}"#;
        let parsed = parse_text(raw).expect("parse");
        assert!(matches!(parsed, Inbound::Cancel(_)));
    }

    #[test]
    fn binary_frame_roundtrip() {
        let id = Uuid::now_v7();
        let payload = b"row1\x1Frow2".to_vec();
        let frame = Outbound::binary(id, payload.clone());
        let msg = frame.into_ws_message().unwrap();
        let bytes: Vec<u8> = match msg {
            Message::Binary(b) => b.to_vec(),
            _ => panic!("expected binary"),
        };
        let (parsed_id, parsed_payload) = parse_binary(&bytes).unwrap();
        assert_eq!(parsed_id, id);
        assert_eq!(parsed_payload, payload.as_slice());
    }

    #[test]
    fn response_serializes_with_end_flag() {
        let id = Uuid::now_v7();
        let frame = Outbound::response(id, serde_json::json!({"ok": true}));
        let msg = frame.into_ws_message().unwrap();
        let s = match msg {
            Message::Text(t) => t.to_string(),
            _ => panic!("text"),
        };
        assert!(s.contains("\"type\":\"response\""));
        assert!(s.contains("\"end\":true"));
        assert!(s.contains(&id.to_string()));
    }
}
