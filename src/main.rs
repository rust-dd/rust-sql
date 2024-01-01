mod app;
mod enums;
mod footer;
mod grid_view;
mod header;
mod invoke;
mod layout;
mod query_editor;
mod query_table;
mod record_view;
mod sidebar;
mod store;
mod wasm_functions;

use app::*;
use leptos::*;

fn main() {
  leptos_devtools::devtools();
  mount_to_body(app)
}
