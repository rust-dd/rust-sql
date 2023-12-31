mod app;
mod db_connector;
mod enums;
mod footer;
mod grid_view;
mod invoke;
mod layout;
mod queries;
mod query_editor;
mod query_table;
mod record_view;
mod sidebar;
mod sidebar_;
mod store;
mod tables;
mod wasm_functions;

use app::*;
use leptos::*;

fn main() {
  leptos_devtools::devtools();
  mount_to_body(app)
}
