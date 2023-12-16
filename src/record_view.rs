use leptos::{html::*, leptos_dom::Each, *};

use crate::store::query::QueryState;

pub fn record_view() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();
  let columns = query_state.sql_result.get().unwrap().0.clone();
  let first_row = query_state
    .sql_result
    .get()
    .unwrap()
    .1
    .first()
    .unwrap()
    .clone();
  let columns_with_values = columns.into_iter().zip(first_row).collect::<Vec<_>>();

  // 2 columns table Properties, Values
  table()
    .classes("table-auto w-full")
    .child(
      thead().classes("sticky top-0 bg-white").child(
        tr()
          .classes("bg-gray-100")
          .child(th().classes("text-xs px-4").child("Properties"))
          .child(th().classes("text-xs px-4").child("Values")),
      ),
    )
    .child(
      tbody().child(
        Each::new(
          move || columns_with_values.clone(),
          move |n| n.clone(),
          move |(col, val)| {
            tr()
              .classes("divide-y divide-gray-200")
              .child(
                td()
                  .classes("px-4 text-xs bg-gray-200 font-semibold")
                  .child(col),
              )
              .child(td().classes("px-4 text-xs hover:bg-gray-100").child(val))
          },
        )
        .into_view(),
      ),
    )
}
