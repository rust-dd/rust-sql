use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use rsql_proxy::protocol::{Outbound, parse_text};
use serde_json::json;
use uuid::Uuid;

fn small_payload() -> serde_json::Value {
    json!({"status": "ok", "rows": 1, "elapsed_ms": 12.4})
}

fn large_payload(rows: usize) -> serde_json::Value {
    let mut data: Vec<serde_json::Value> = Vec::with_capacity(rows);
    for i in 0..rows {
        data.push(json!({"id": i, "name": format!("user_{i}"), "score": (i as f64) * 1.7}));
    }
    json!({"columns": ["id", "name", "score"], "data": data})
}

fn binary_payload(bytes: usize) -> Vec<u8> {
    (0..bytes).map(|i| (i % 251) as u8).collect()
}

fn bench_encode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_encode_text");
    let id = Uuid::now_v7();
    for (label, value) in [
        ("small", small_payload()),
        ("1k_rows", large_payload(1_000)),
        ("10k_rows", large_payload(10_000)),
    ] {
        group.bench_with_input(BenchmarkId::from_parameter(label), &value, |b, payload| {
            b.iter(|| {
                let frame = Outbound::response(id, payload.clone());
                let msg = frame.into_ws_message().expect("encode");
                std::hint::black_box(msg);
            });
        });
    }
    group.finish();
}

fn bench_encode_binary(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_encode_binary");
    let id = Uuid::now_v7();
    for size in [1_024usize, 65_536, 1_048_576] {
        let payload = binary_payload(size);
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), &payload, |b, payload| {
            b.iter(|| {
                let frame = Outbound::binary(id, payload.clone());
                let msg = frame.into_ws_message().expect("encode");
                std::hint::black_box(msg);
            });
        });
    }
    group.finish();
}

fn bench_decode(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol_decode_text");
    let request = r#"{"type":"request","id":"01928f5c-1234-7abc-9def-0123456789ab","cmd":"pgsql_run_query","payload":{"project_id":"p","sql":"SELECT 1"}}"#;
    group.bench_function("typical_request", |b| {
        b.iter(|| {
            let inbound = parse_text(request).expect("parse");
            std::hint::black_box(inbound);
        });
    });
    group.finish();
}

criterion_group!(benches, bench_encode, bench_encode_binary, bench_decode);
criterion_main!(benches);
