use rsql_proxy::protocol::{parse_binary, parse_text, Inbound, Outbound};
use uuid::Uuid;

#[test]
fn binary_frame_includes_id_prefix() {
    let id = Uuid::now_v7();
    let frame = Outbound::binary(id, b"hello".to_vec());
    let msg = frame.into_ws_message().unwrap();
    let bytes = match msg {
        axum::extract::ws::Message::Binary(b) => b.to_vec(),
        _ => panic!("expected binary"),
    };
    let (parsed_id, payload) = parse_binary(&bytes).unwrap();
    assert_eq!(parsed_id, id);
    assert_eq!(payload, b"hello");
}

#[test]
fn cancel_frame_parses() {
    let id = Uuid::now_v7();
    let raw = format!(r#"{{"type":"cancel","id":"{id}"}}"#);
    let parsed = parse_text(&raw).unwrap();
    assert!(matches!(parsed, Inbound::Cancel(c) if c.id == id));
}
