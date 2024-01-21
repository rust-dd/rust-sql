use leptos::{html::*, *};

use crate::store::tabs::TabsStore;

pub fn component() -> impl IntoView {
  let tabs_store = use_context::<TabsStore>().unwrap();
  let columns = tabs_store.select_active_editor_sql_result().unwrap().0;
  let first_row = tabs_store
    .select_active_editor_sql_result()
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
    .child(tbody().child(For(ForProps {
      each: move || columns_with_values.clone(),
      key: |(col, _)| col.clone(),
      children: move |(col, val)| {
        tr()
          .classes("divide-y divide-gray-200")
          .child(
            td()
              .classes("px-4 text-xs bg-gray-200 font-semibold")
              .child(col),
          )
          .child(td().classes("px-4 text-xs hover:bg-gray-100").child(val))
      },
    })))
}
