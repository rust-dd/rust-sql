use crate::{
  enums::QueryTableLayout, grid_view::grid_view, record_view::record_view, store::query::QueryState,
};
use leptos::{html::*, *};

pub fn query_table() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();
  let table_layout = move || match query_state.sql_result.get() {
    None => div(),
    Some(_) => match table_view() {
      QueryTableLayout::Grid => div().child(grid_view()),
      QueryTableLayout::Records => div().child(record_view()),
    },
  };
  let when = move || !query_state.is_loading.get();
  let fallback = ViewFn::from(|| p().classes("pl-2").child("Loading..."));
  let children = ChildrenFn::to_children(move || Fragment::new(vec![table_layout().into_view()]));

  Show(ShowProps {
    children,
    when,
    fallback,
  })
}
