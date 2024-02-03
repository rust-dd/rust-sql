use leptos::*;

use crate::{
  enums::QueryTableLayout,
  layout,
  store::{
    active_project::ActiveProjectStore, projects::ProjectsStore, query::QueryStore, tabs::TabsStore,
  },
};

// TODO: help to add custom langunage support
// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs

pub fn app() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(create_rw_signal(0.0f32));
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());

  layout::component()
}
