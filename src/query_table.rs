use crate::{
  enums::QueryTableLayout, grid_view::grid_view, record_view::record_view, store::query::QueryState,
};
use leptos::{html::*, *};

pub fn query_table() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();
  let when = move || !query_state.is_loading.get();
  let fallback = ViewFn::from(|| p().classes("pl-2").child("Loading..."));
  let children = ChildrenFn::to_children(move || {
    Fragment::new(vec![match table_view() {
      QueryTableLayout::Grid => div().child(grid_view()),
      QueryTableLayout::Records => div().child(record_view()),
    }
    .into_view()])
  });

  Show(ShowProps {
    children,
    when,
    fallback,
  })
}
