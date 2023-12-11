mod app;
mod db_connector;
mod invoke;
mod layout;
mod query_editor;
mod query_table;
mod sidebar;
mod store;
mod tables;
mod wasm_functions;

use app::*;
use leptos::*;

fn main() {
  leptos_devtools::devtools();
  mount_to_body(app)
}
