use std::vec;

use crate::{
  enums::QueryTableLayout,
  layout::layout,
  query_editor::query_editor,
  query_table::query_table,
  store::{db::DBStore, editor::EditorState, projects::ProjectsStore, query::QueryStore},
};
use leptos::*;

pub fn app() -> impl IntoView {
  provide_context(DBStore::default());
  provide_context(EditorState::default());
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));

  layout(Children::to_children(move || {
    Fragment::new(vec![query_editor().into_view(), query_table().into_view()])
  }))
}
