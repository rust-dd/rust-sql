#!/usr/bin/env bash
# Fails if rsql-core gains a forbidden dependency (tauri/axum/tokio-tungstenite).
# The rsql-core crate must remain a pure-Rust library so it can be reused by
# both the desktop Tauri bin and the upcoming rsql-proxy WebSocket bin.

set -euo pipefail

cd "$(dirname "$0")/.."

forbidden_patterns='^[│ ]*(tauri[- ]|axum[- ]|tokio-tungstenite[- ])'

if cargo tree -p rsql-core --depth 99 2>/dev/null | grep -E "$forbidden_patterns" >/dev/null; then
    echo "FAIL: rsql-core has a forbidden dependency."
    cargo tree -p rsql-core --depth 99 | grep -E "$forbidden_patterns" || true
    exit 1
fi

echo "OK: rsql-core is pure-Rust (no tauri/axum/tokio-tungstenite deps)."
