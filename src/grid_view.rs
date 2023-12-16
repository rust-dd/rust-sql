use leptos::{html::*, leptos_dom::Each, *};

use crate::store::query::QueryState;

pub fn grid_view() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();

  table()
    .classes("table-auto w-full")
    .child(
      thead()
        .classes("sticky top-0 bg-white")
        .child(tr().classes("bg-gray-100").child(Each::new(
          move || query_state.sql_result.get().unwrap().0.clone(),
          move |n| n.clone(),
          move |col| th().classes("text-xs px-4").child(col),
        ))),
    )
    .child(tbody().child(Each::new(
      move || query_state.sql_result.get().unwrap().1.clone(),
      move |n| n.clone(),
      move |row| {
        tr()
          .classes("hover:bg-gray-100 divide-x divide-gray-200")
          .child(Each::new(
            move || row.clone(),
            move |n| n.clone(),
            move |cell| td().classes("px-4 text-xs cursor:pointer").child(cell),
          ))
      },
    )))
}
