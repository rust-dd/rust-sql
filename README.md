# RSQL

A high-performance PostgreSQL client built with Tauri v2, React, and Rust. Designed from the ground up to be fast — even with millions of rows.

![Preview](https://i.ibb.co/Y7yfRw9Z/rsql.png)

## Why It's Fast

### Zero-Copy Wire Protocol
Queries use PostgreSQL's **simple_query protocol** — the server returns all values as pre-formatted text. No type conversion, no ORM mapping, no intermediate representations. Raw text goes straight from the TCP socket to the frontend.

### Packed Binary IPC
Results are encoded as flat strings with ASCII unit/record separators (`\x1F` / `\x1E`), not nested JSON arrays. This eliminates JSON serialization overhead entirely for result data. A 100K-row result serializes in microseconds, not milliseconds.

### Pre-Allocated String Packing
Row packing uses a single pre-allocated `String` buffer with capacity estimation. No intermediate `Vec<String>` per row, no `.join()` chains, no `.replace()` allocations. Separator sanitization is done inline, character by character.

### Virtual Pagination with Server-Side Cursors
Large results (>2K rows) use PostgreSQL cursors with `FETCH` batching. Pages are pre-packed into cache-friendly strings on the Rust side. Page serving is O(1) — zero packing at read time. Only pages near the viewport are kept in memory; distant pages are evicted automatically.

### Dual Connection Pool
Each database connection maintains two TCP sockets:
- **Query connection** — user queries, EXPLAIN, virtual pagination
- **Metadata connection** — schema loading, table info, activity monitoring

This means metadata loads never block while a long query runs, and vice versa.

### WebGL Canvas Rendering
The results grid renders directly to a WebGL canvas via `@glideapps/glide-data-grid`. No DOM nodes per cell. Scrolling through 500K rows is as smooth as scrolling through 50.

Virtual scroll invalidation uses `requestAnimationFrame` batching — multiple page fetches within one frame cause only one re-render. Theme override objects are pre-computed once, not re-created per cell.

### Streaming IPC
Large results are streamed in 10K-row chunks via Tauri events for progressive rendering. The frontend starts displaying rows before the query finishes. Capped at 500K rows to protect webview memory.

### Parallel Processing
Results over 50K rows use Rayon for parallel page packing across CPU cores. Below that threshold, sequential processing is faster due to cache locality.

### Debounced Search
Full-text search across results is debounced at 200ms to avoid filtering 50K+ rows on every keystroke.

### Multi-Statement Execution
`simple_query` handles `SELECT 1; INSERT ...; SELECT * FROM users;` natively. Returns the last result set that had rows — no splitting or reparsing on the client side.

## Features

- **Monaco SQL editor** — syntax highlighting, context-aware autocomplete (schemas, tables, columns, aliases), SQL snippets, formatter
- **Results grid** — WebGL canvas, column sorting, inline editing (UPDATE/DELETE with transactions), export (CSV, JSON, SQL, Markdown, XML)
- **Database explorer** — tree sidebar with schemas, tables, views, materialized views, functions, triggers, indexes, constraints, policies
- **ERD diagrams** — interactive entity-relationship diagrams with FK lines, drag-and-drop, SVG export
- **FK navigation** — click foreign key values to jump to referenced rows
- **Map view** — automatic detection of PostGIS geometry/geography columns (WKT, GeoJSON, EWKB), rendered on OpenStreetMap tiles via Leaflet with Point, LineString, and Polygon support
- **EXPLAIN visualizer** — `EXPLAIN (ANALYZE, FORMAT JSON)` with plan tree rendering
- **Performance monitor** — live `pg_stat_activity`, database stats, table stats
- **Diff tool** — pin a result, run another query, see added/removed rows (diff computed in Rust)
- **Inline terminal** — built-in PTY terminal via `portable-pty` + `xterm.js`
- **Command palette** — Cmd+K/Cmd+P fuzzy search across all database objects, actions, and saved workspaces
- **Workspaces** — save and restore tab groups across sessions
- **Query history** — searchable execution history with timing and row counts
- **Notifications** — OS-level notifications for long-running queries (>5s) when app is unfocused

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Zustand, Monaco Editor, Leaflet |
| UI | Tailwind CSS v4, shadcn/ui, oklch color system |
| Results Grid | @glideapps/glide-data-grid (WebGL canvas) |
| Terminal | xterm.js + portable-pty |
| Backend | Rust, Tauri v2, tokio-postgres (simple_query protocol) |
| Performance | rayon (parallel packing), packed binary IPC, dual connection pool, rAF-batched rendering |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```
