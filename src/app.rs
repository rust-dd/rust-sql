use std::vec;

use crate::{
  enums::QueryTableLayout,
  layout, query_editor, query_table,
  store::{
    active_project::ActiveProjectStore, editor::EditorStore, projects::ProjectsStore,
    query::QueryStore,
  },
};
use leptos::*;

pub fn app() -> impl IntoView {
  provide_context(EditorStore::default());
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(ActiveProjectStore::default());

  layout::component(Children::to_children(move || {
    Fragment::new(vec![
      query_editor::component().into_view(),
      query_table::component().into_view(),
    ])
  }))
}
