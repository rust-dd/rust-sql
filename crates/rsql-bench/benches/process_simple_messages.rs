use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use rsql_core::drivers::pgsql::query_execution::{pack_rows_vec, process_simple_messages};

// Synthesise a (columns, rows) pair directly. `SimpleQueryMessage::Row` /
// `CommandComplete` constructors are private to tokio_postgres, so feeding
// `process_simple_messages` synthetic input requires a live PG connection.
// The realistic hot path that follows it (`pack_rows_vec`) is covered here;
// the message-decoding loop itself is a single mem copy per cell, not
// representative of the WS workload bottleneck.
fn synth_rows(rows: usize, cols: usize) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = (0..cols).map(|c| format!("col_{c}")).collect::<Vec<_>>();
    let mut data = Vec::with_capacity(rows);
    for r in 0..rows {
        let row = (0..cols)
            .map(|c| format!("r{r}c{c}_val_abcdefghij"))
            .collect::<Vec<_>>();
        data.push(row);
    }
    (columns, data)
}

fn bench_full_pack(c: &mut Criterion) {
    let mut group = c.benchmark_group("pack_full_resultset");
    group.sample_size(20);
    for &rows in &[1_000usize, 100_000, 1_000_000] {
        let (_cols, data) = synth_rows(rows, 10);
        let bytes: u64 = data
            .iter()
            .map(|r| r.iter().map(|s| s.len() as u64).sum::<u64>())
            .sum();
        group.throughput(Throughput::Bytes(bytes));
        group.bench_with_input(BenchmarkId::from_parameter(rows), &data, |b, data| {
            b.iter(|| {
                let packed = pack_rows_vec(data);
                std::hint::black_box(packed);
            });
        });
    }
    group.finish();
}

fn bench_setup_overhead(c: &mut Criterion) {
    c.bench_function("synth_rows_setup_1m", |b| {
        b.iter(|| {
            let (cols, rows) = synth_rows(1_000_000, 10);
            std::hint::black_box((cols, rows));
        });
    });
    let _ = process_simple_messages;
}

criterion_group!(benches, bench_full_pack, bench_setup_overhead);
criterion_main!(benches);
