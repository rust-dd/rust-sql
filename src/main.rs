#![feature(pattern)]

mod app;
mod databases;
mod enums;
mod footer;
mod grid_view;
mod invoke;
mod modals;
mod queries;
mod query_editor;
mod query_table;
mod record_view;
mod sidebar;
mod store;

use app::App;
use leptos::*;

fn main() {
  leptos_devtools::devtools();
  mount_to_body(|| view! { <App/> })
}

