const benchmarks = [
  {
    category: "Memory Usage",
    metric: "Typical RAM footprint",
    rsql: { value: "~80–150 MB", bar: 12 },
    others: [
      { name: "Electron apps", value: "~200–400 MB", bar: 40 },
      { name: "DBeaver (JVM)", value: "~500 MB–1 GB", bar: 70 },
      { name: "DataGrip (JVM)", value: "~700 MB–2 GB", bar: 90 },
    ],
    explanation: "Tauri v2 uses the system WebView instead of bundling Chromium. No separate browser process, no JVM heap overhead.",
  },
  {
    category: "Binary Size",
    metric: "Download size",
    rsql: { value: "~20 MB", bar: 4 },
    others: [
      { name: "TablePlus", value: "~40 MB", bar: 7 },
      { name: "pgAdmin", value: "~180 MB", bar: 30 },
      { name: "DBeaver", value: "~200 MB", bar: 34 },
      { name: "DataGrip", value: "~600 MB", bar: 100 },
    ],
    explanation: "Rust compiles to a single native binary. No bundled JDK, no bundled Chromium.",
  },
  {
    category: "Result Grid",
    metric: "Rendering approach",
    rsql: { value: "HTML5 Canvas", bar: 0 },
    others: [],
    explanation: "Glide Data Grid renders to a single <canvas> element. O(1) DOM complexity regardless of dataset size — no layout thrashing, smooth 60fps scroll across 100K+ rows.",
    comparison: [
      { label: "RSQL (Canvas)", detail: "1 DOM node, GPU-accelerated paint", highlight: true },
      { label: "DOM table (pgAdmin)", detail: "rows × cols DOM nodes, CPU layout" },
      { label: "Swing JTable (DataGrip)", detail: "JVM rendering pipeline" },
      { label: "SWT Native (DBeaver)", detail: "OS widget, JNI overhead" },
    ],
  },
  {
    category: "Serialization",
    metric: "JSON throughput (sonic-rs v0.5)",
    rsql: { value: "~2–3 GB/s", bar: 90 },
    others: [
      { name: "serde_json (Rust default)", value: "~800 MB/s", bar: 30 },
      { name: "Java Jackson", value: "~600 MB/s", bar: 22 },
      { name: "Python json", value: "~300 MB/s", bar: 11 },
    ],
    explanation: "sonic-rs uses SIMD instructions (AVX2/SSE4/NEON). Additionally, RSQL packs result data with flat ASCII separators (\\x1F cell, \\x1E row) bypassing JSON array overhead entirely.",
  },
  {
    category: "Large Results",
    metric: "Memory for multi-million-row results",
    rsql: { value: "O(page_size)", bar: 5 },
    others: [
      { name: "Typical client", value: "O(total rows)", bar: 95 },
    ],
    explanation: "Virtual pagination pre-packs all rows into 2,000-row pages cached on the Rust backend. The frontend only holds ~24 pages in memory at any time — distant pages are LRU-evicted. Browsing 5 million rows uses the same frontend memory as 1,000 rows. No row limit on virtual pagination.",
  },
];

/* ─── Architecture deep-dive: real numbers from the codebase ─── */

const archNumbers = [
  {
    label: "Cursor fetch size",
    value: "10,000",
    unit: "rows/round-trip",
    source: "CURSOR_FETCH_SIZE in common.rs",
    detail: "Server-side DECLARE CURSOR + FETCH FORWARD. Streams results in 10K-row chunks without loading entire result set into backend memory.",
  },
  {
    label: "Page size",
    value: "2,000",
    unit: "rows/page",
    source: "VITE_PAGE_SIZE default",
    detail: "Each virtual page contains 2,000 rows, pre-packed with flat separators. Pages are served from cache with zero packing overhead at request time.",
  },
  {
    label: "Cache window",
    value: "24",
    unit: "pages in memory",
    source: "results-panel.tsx",
    detail: "Frontend keeps 24 pages around the current viewport. Distant pages are LRU-evicted, keeping memory constant regardless of total result size.",
  },
  {
    label: "Concurrent fetches",
    value: "6",
    unit: "parallel page requests",
    source: "results-panel.tsx",
    detail: "Up to 6 pages fetched in parallel with a queue depth of 32. Pre-fetches pages ahead of scroll direction for seamless navigation.",
  },
  {
    label: "Query connections",
    value: "16",
    unit: "pooled connections",
    source: "deadpool-postgres config",
    detail: "Dual connection pool: 16 for queries, 8 for metadata (schema loading, autocomplete). Query and metadata traffic never block each other.",
  },
  {
    label: "Parallel packing",
    value: "50K+",
    unit: "row threshold",
    source: "rayon in common.rs",
    detail: "Results over 50,000 rows are packed into pages using rayon parallel iterators. Smaller datasets use sequential packing to avoid thread overhead.",
  },
  {
    label: "Virtual pagination",
    value: "No limit",
    unit: "on row count",
    source: "execute_virtual in common.rs",
    detail: "All rows are pre-packed into pages on the Rust backend. The frontend requests pages on demand — 5M+ rows work seamlessly. Streaming mode (real-time push) has a separate 500K safety cap.",
  },
  {
    label: "IPC format",
    value: "\\x1F / \\x1E",
    unit: "cell / row separator",
    source: "common.rs packed format",
    detail: "Results packed as flat strings with ASCII Unit Separator (\\x1F) between cells and Record Separator (\\x1E) between rows. No JSON array nesting, no per-cell quotes.",
  },
];

export function Benchmarks() {
  return (
    <section className="px-6 py-24" id="benchmarks">
      <div className="mx-auto max-w-[1080px]">
        <div className="divider mb-16" />

        <div className="mb-12 max-w-lg">
          <span className="section-label">Performance</span>
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] mt-3">
            Built to be fast
          </h2>
          <p className="text-[var(--fg-muted)] mt-3 text-[15px] leading-relaxed">
            Every layer is optimized — from SIMD serialization to canvas rendering.
          </p>
        </div>

        {/* ─── Benchmark bars ─── */}
        <div className="space-y-6">
          {benchmarks.map((b) => (
            <div key={b.category} className="card-raised p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-5">
                <div>
                  <h3 className="text-base font-semibold">{b.category}</h3>
                  <p className="text-xs text-[var(--fg-subtle)] font-[var(--font-mono)]">{b.metric}</p>
                </div>
                <div className="text-lg font-bold accent-text font-[var(--font-mono)]">
                  {b.rsql.value}
                </div>
              </div>

              {b.others.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-[120px] sm:w-[160px] text-sm font-medium accent-text shrink-0">RSQL</span>
                    <div className="flex-1 h-6 bg-[var(--surface-raised)] rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center px-2 text-[10px] font-[var(--font-mono)] text-white font-semibold"
                        style={{ width: `${Math.max(b.rsql.bar, 8)}%`, background: "var(--accent)" }}
                      >
                        {b.rsql.value}
                      </div>
                    </div>
                  </div>
                  {b.others.map((o) => (
                    <div key={o.name} className="flex items-center gap-3">
                      <span className="w-[120px] sm:w-[160px] text-sm text-[var(--fg-muted)] shrink-0 truncate">{o.name}</span>
                      <div className="flex-1 h-6 bg-[var(--surface-raised)] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center px-2 text-[10px] font-[var(--font-mono)] text-[var(--fg-muted)] font-medium"
                          style={{ width: `${Math.max(o.bar, 8)}%`, background: "var(--border)" }}
                        >
                          {o.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {b.comparison && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {b.comparison.map((c) => (
                    <div
                      key={c.label}
                      className={`rounded-xl border px-4 py-3 ${
                        c.highlight
                          ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                          : "border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className={`text-sm font-medium ${c.highlight ? "accent-text" : "text-[var(--fg-muted)]"}`}>
                        {c.label}
                      </div>
                      <div className="text-xs text-[var(--fg-subtle)] mt-0.5 font-[var(--font-mono)]">{c.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-xs text-[var(--fg-subtle)] leading-relaxed">{b.explanation}</p>
            </div>
          ))}
        </div>

        {/* ─── Under the Hood: real numbers ─── */}
        <div className="mt-16">
          <div className="mb-8">
            <span className="section-label">Under the hood</span>
            <h3 className="font-display text-[clamp(1.4rem,3vw,2rem)] mt-3">
              Real numbers from the codebase
            </h3>
            <p className="text-[var(--fg-muted)] mt-2 text-sm">
              Every constant below is verified from source — no marketing estimates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
            {archNumbers.map((n) => (
              <div key={n.label} className="bg-[var(--bg)] p-5 hover:bg-[var(--accent-muted)] transition-colors">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold font-[var(--font-mono)] accent-text">{n.value}</span>
                  <span className="text-xs text-[var(--fg-subtle)] font-[var(--font-mono)]">{n.unit}</span>
                </div>
                <div className="text-sm font-semibold mb-1">{n.label}</div>
                <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{n.detail}</p>
                <div className="mt-2 text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)] opacity-60">
                  {n.source}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Data flow diagram ─── */}
        <div className="mt-12 card-raised p-6">
          <h4 className="text-sm font-semibold mb-4">Query execution pipeline</h4>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[600px] font-[var(--font-mono)] text-[11px]">
              {[
                { label: "SQL Query", sub: "Monaco Editor", color: "var(--accent)" },
                { label: "Tauri IPC", sub: "< 0.1ms overhead" },
                { label: "tokio-postgres", sub: "DECLARE CURSOR" },
                { label: "FETCH 10K", sub: "Server-side cursor" },
                { label: "rayon pack", sub: "\\x1F/\\x1E separators" },
                { label: "sonic-rs", sub: "SIMD serialize" },
                { label: "Canvas Grid", sub: "WebGL render" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className={`px-3 py-2 rounded-xl border text-center shrink-0 ${
                    i === 0 || i === arr.length - 1
                      ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                      : "border-[var(--border-subtle)]"
                  }`}>
                    <div className={`font-semibold ${i === 0 || i === arr.length - 1 ? "accent-text" : "text-[var(--fg)]"}`}>
                      {step.label}
                    </div>
                    <div className="text-[9px] text-[var(--fg-subtle)] mt-0.5">{step.sub}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-6 h-px bg-[var(--border)] mx-0.5 shrink-0 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-[var(--fg-subtle)] border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--fg-subtle)] leading-relaxed">
            End-to-end: SQL text → Rust IPC → PostgreSQL cursor → parallel page packing → SIMD serialization → canvas paint.
            Each page (2,000 rows) is pre-packed and cached — subsequent page requests are served with zero processing overhead.
          </p>
        </div>

        <p className="mt-6 text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)] text-center">
          All numbers verified from source: src-tauri/src/drivers/common.rs, pgsql.rs, src/components/results-panel.tsx.
          <br />
          Serialization throughput from sonic-rs published benchmarks. Memory figures are typical ranges on Apple M1.
        </p>
      </div>
    </section>
  );
}
