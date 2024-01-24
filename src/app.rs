use js_sys::Object;
use leptos::*;
use monaco::sys::languages::{
  register, set_language_configuration, set_monarch_tokens_provider, ILanguageExtensionPoint,
};
use wasm_bindgen::{prelude::*, JsCast};

use crate::{
  enums::QueryTableLayout,
  layout,
  store::{
    active_project::ActiveProjectStore, projects::ProjectsStore, query::QueryStore, tabs::TabsStore,
  },
};

pub const MODE_ID: &str = "pgsql";

// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs
#[wasm_bindgen(module = "/js/pgsql.js")]
extern "C" {
  #[wasm_bindgen(js_name = "conf")]
  pub fn pgsql_conf() -> Object;

  #[wasm_bindgen(js_name = "language")]
  pub fn pgsql_language() -> Object;
}

pub fn register_sql() {
  let language: ILanguageExtensionPoint = Object::new().unchecked_into();
  language.set_id(MODE_ID);
  register(&language);
  set_monarch_tokens_provider(MODE_ID, &pgsql_language().into());
  set_language_configuration(MODE_ID, &pgsql_conf().unchecked_into());
}

pub fn app() -> impl IntoView {
  register_sql();

  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());

  layout::component()
}
