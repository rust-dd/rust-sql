# RSQL

A high-performance SQL database client built with Tauri v2, React 19, and Rust.

![Preview](https://i.ibb.co/Y7yfRw9Z/rsql.png)

## Features

### Query Editor
- Monaco-based SQL editor with syntax highlighting (PostgreSQL dialect)
- Context-aware autocomplete: schema, table, column, and alias completion
- SQL snippets and templates (SELECT, INSERT, UPDATE, JOIN, CTE, etc.)
- SQL formatter (Cmd+Shift+F)
- Query history with search and re-execute
- Multi-tab editor with tab persistence across restarts
- Execute queries with Cmd+Enter, EXPLAIN with Cmd+Shift+Enter

### Results
- GPU-accelerated results grid via WebGL canvas (@glideapps/glide-data-grid)
- Grid view, record view, and map view (for PostGIS/geometry data)
- Column sorting
- Full-text search/filter across results
- Export to CSV, JSON, SQL INSERT, Markdown, XML, and clipboard
- Pin results for later diff comparison
- Diff tool (computed in Rust for performance) showing added/removed rows
- Inline table editing: UPDATE and DELETE directly from the grid with transaction support

### Database Explorer
- Tree-based sidebar with schemas, tables, views, materialized views, functions, trigger functions
- Column details with types, indexes, constraints, triggers, rules, policies
- DDL view (SHOW CREATE TABLE/VIEW/FUNCTION)
- Saved queries with per-project organization
- Global fuzzy search (Cmd+P) across all database objects

### ERD Diagram
- Interactive entity-relationship diagram with drag-and-drop tables
- Primary key and foreign key indicators
- Column types and nullable markers
- FK relationship lines with hover highlighting
- Zoom controls and SVG export
- Grid background with fit-to-view

### Foreign Key Traverse
- FK columns highlighted in blue in results grid
- Click FK values to navigate to referenced rows (auto-executes query)
- Works with schema-qualified table references

### Geospatial Data
- Automatic detection of geometry/geography columns (WKT, GeoJSON, EWKB)
- Map view with OpenStreetMap tiles via Leaflet
- Supports Point, LineString, and Polygon geometries
- Popup info with row data on geometry click

### Performance Monitor
- Live database activity (pg_stat_activity)
- Database statistics
- Table statistics with size info

### Inline Terminal
- Built-in PTY terminal (portable-pty)
- xterm.js with fit addon
- Open with Cmd+` or terminal button in tab bar

### Performance
- Streaming IPC: query results streamed in 5K-row chunks via Tauri events for progressive rendering
- Packed wire format with ASCII separators (avoids JSON overhead of nested arrays)
- SIMD JSON serialization with sonic-rs
- Parallel row processing with rayon for large datasets (>1000 rows per chunk)
- WebGL canvas rendering for millions of rows without DOM overhead

### Supported Databases
- PostgreSQL

### Other
- Light/dark theme with blue-purple accent palette
- Native macOS menu with About dialog
- OS notifications for long-running queries
- Saved queries with per-project organization
- Tab persistence across app restarts (editor content, ERD tabs)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Zustand, Monaco Editor, Leaflet |
| UI | Tailwind CSS v4, shadcn/ui components, oklch color system |
| Results Grid | @glideapps/glide-data-grid (WebGL canvas) |
| Terminal | xterm.js + portable-pty |
| Backend | Rust, Tauri v2, tokio-postgres |
| Performance | sonic-rs (SIMD JSON), rayon (parallel), streaming IPC |

## Development

```bash
# Install dependencies
yarn

# Run in development mode
yarn tauri dev

# Build for production
yarn tauri build
```
