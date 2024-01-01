use leptos::{html::*, *};

use crate::store::query::QueryStore;

pub fn grid_view() -> impl IntoView {
  let query_state = use_context::<QueryStore>().unwrap();

  table()
    .classes("table-auto w-full")
    .child(
      thead()
        .classes("sticky top-0 bg-white")
        .child(tr().classes("bg-gray-100").child(For(ForProps {
          each: move || query_state.sql_result.get().unwrap().0.clone(),
          key: |n| n.clone(),
          children: move |col| th().classes("text-xs px-4").child(col),
        }))),
    )
    .child(tbody().child(For(ForProps {
      each: move || query_state.sql_result.get().unwrap().1.clone(),
      key: |n| n.clone(),
      children: move |row| {
        tr()
          .classes("hover:bg-gray-100 divide-x divide-gray-200")
          .child(For(ForProps {
            each: move || row.clone(),
            key: |n| n.clone(),
            children: move |cell| td().classes("px-4 text-xs cursor:pointer").child(cell),
          }))
      },
    })))
}
