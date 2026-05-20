use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use rsql_core::drivers::pgsql::query_execution::pack_rows_vec;

fn make_rows(n: usize, cols: usize) -> Vec<Vec<String>> {
    let mut out = Vec::with_capacity(n);
    for r in 0..n {
        let mut row = Vec::with_capacity(cols);
        for c in 0..cols {
            row.push(format!("r{r}c{c}_xyz_0123456789"));
        }
        out.push(row);
    }
    out
}

fn bench_pack_rows(c: &mut Criterion) {
    let mut group = c.benchmark_group("pack_rows_vec");
    group.sample_size(20);
    for size in [1_000usize, 10_000, 100_000, 1_000_000] {
        let rows = make_rows(size, 10);
        let bytes: u64 = rows
            .iter()
            .map(|r| r.iter().map(|s| s.len() as u64).sum::<u64>())
            .sum();
        group.throughput(Throughput::Bytes(bytes));
        group.bench_with_input(BenchmarkId::from_parameter(size), &rows, |b, rows| {
            b.iter(|| {
                let packed = pack_rows_vec(rows);
                std::hint::black_box(packed);
            });
        });
    }
    group.finish();
}

criterion_group!(benches, bench_pack_rows);
criterion_main!(benches);
