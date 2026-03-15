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
    explanation: "Glide Data Grid renders to a single <canvas> element. O(1) DOM complexity regardless of dataset size — no layout thrashing, smooth 60fps scroll across 100K+ rows. DOM-based tables create one <td> per visible cell, causing browser reflow on every scroll event.",
    comparison: [
      { label: "RSQL (Canvas)", detail: "1 DOM node, GPU-accelerated paint", highlight: true },
      { label: "DOM table (pgAdmin)", detail: "rows × cols DOM nodes, CPU layout" },
      { label: "Swing JTable (DataGrip)", detail: "JVM rendering pipeline" },
      { label: "SWT Native (DBeaver)", detail: "OS widget, JNI overhead" },
    ],
  },
  {
    category: "Serialization",
    metric: "JSON throughput",
    rsql: { value: "~2–3 GB/s", bar: 90 },
    others: [
      { name: "serde_json (Rust default)", value: "~800 MB/s", bar: 30 },
      { name: "Python json", value: "~300 MB/s", bar: 11 },
      { name: "Java Jackson", value: "~600 MB/s", bar: 22 },
    ],
    explanation: "sonic-rs uses SIMD instructions (AVX2/SSE4/NEON) for JSON serialization. All Tauri IPC responses bypass default serde_json — raw packed responses for maximum throughput.",
  },
  {
    category: "Large Results",
    metric: "Memory for 10M rows",
    rsql: { value: "O(page_size)", bar: 5 },
    others: [
      { name: "Typical client", value: "O(total rows)", bar: 95 },
    ],
    explanation: "Server-side cursors with DECLARE CURSOR + FETCH FORWARD. Virtual pagination keeps only nearby pages in memory. Distant pages are evicted automatically. Browsing 10M rows uses the same memory as 1K rows.",
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

        <div className="space-y-6">
          {benchmarks.map((b) => (
            <div key={b.category} className="card-raised p-6">
              {/* Header */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-5">
                <div>
                  <h3 className="text-base font-semibold">{b.category}</h3>
                  <p className="text-xs text-[var(--fg-subtle)] font-[var(--font-mono)]">{b.metric}</p>
                </div>
                <div className="text-lg font-bold accent-text font-[var(--font-mono)]">
                  {b.rsql.value}
                </div>
              </div>

              {/* Bar chart (if has others) */}
              {b.others.length > 0 && (
                <div className="space-y-3">
                  {/* RSQL bar */}
                  <div className="flex items-center gap-3">
                    <span className="w-[120px] sm:w-[160px] text-sm font-medium accent-text shrink-0">RSQL</span>
                    <div className="flex-1 h-6 bg-[var(--surface-raised)] rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center px-2 text-[10px] font-[var(--font-mono)] text-white font-semibold"
                        style={{
                          width: `${Math.max(b.rsql.bar, 8)}%`,
                          background: "var(--accent)",
                        }}
                      >
                        {b.rsql.value}
                      </div>
                    </div>
                  </div>
                  {/* Others */}
                  {b.others.map((o) => (
                    <div key={o.name} className="flex items-center gap-3">
                      <span className="w-[120px] sm:w-[160px] text-sm text-[var(--fg-muted)] shrink-0 truncate">{o.name}</span>
                      <div className="flex-1 h-6 bg-[var(--surface-raised)] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg flex items-center px-2 text-[10px] font-[var(--font-mono)] text-[var(--fg-muted)] font-medium"
                          style={{
                            width: `${Math.max(o.bar, 8)}%`,
                            background: "var(--border)",
                          }}
                        >
                          {o.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comparison list (for grid tech) */}
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
                      <div className="text-xs text-[var(--fg-subtle)] mt-0.5 font-[var(--font-mono)]">
                        {c.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Explanation */}
              <p className="mt-4 text-xs text-[var(--fg-subtle)] leading-relaxed">
                {b.explanation}
              </p>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="mt-6 text-[10px] text-[var(--fg-subtle)] font-[var(--font-mono)] text-center">
          Memory and size figures are typical ranges. Serialization throughput from sonic-rs benchmarks.
          <br />
          RSQL architecture: Tauri v2, tokio-postgres, sonic-rs, Glide Data Grid, rayon.
        </p>
      </div>
    </section>
  );
}
