use crate::{enums::QueryTableLayout, grid_view, record_view, store::tabs::TabsStore};
use leptos::{html::*, *};

pub fn component() -> impl IntoView {
  let tabs_store = use_context::<TabsStore>().unwrap();
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();
  let table_layout = move || match tabs_store.select_active_editor_sql_result() {
    None => div(),
    Some(_) => match table_view() {
      QueryTableLayout::Grid => div().child(grid_view::component()),
      QueryTableLayout::Records => div().child(record_view::component()),
    },
  };
  let when = move || !tabs_store.is_loading.get();
  let fallback = ViewFn::from(|| p().classes("pl-2").child("Loading..."));
  let children = ChildrenFn::to_children(move || Fragment::new(vec![table_layout().into_view()]));

  Show(ShowProps {
    children,
    when,
    fallback,
  })
}
