use leptos::*;

use crate::{
  enums::QueryTableLayout,
  layout,
  store::{
    active_project::ActiveProjectStore, projects::ProjectsStore, query::QueryStore, tabs::TabsStore,
  },
};

// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs
// #[wasm_bindgen(module = "/js/pgsql.js")]
// extern "C" {
//   #[wasm_bindgen(js_name = "load_env")]
//   pub fn pgsql_worker() -> Object;
// }

pub fn app() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());

  layout::component()
}
