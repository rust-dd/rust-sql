use leptos::{html::*, *};

use crate::store::tabs::TabsStore;

pub fn component() -> impl IntoView {
  let tabs_store = use_context::<TabsStore>().unwrap();

  table()
    .classes("table-auto w-full")
    .child(
      thead()
        .classes("sticky top-0 bg-white")
        .child(tr().classes("bg-gray-100").child(For(ForProps {
          each: move || tabs_store.select_active_editor_sql_result().unwrap().0,
          key: |n| n.clone(),
          children: move |col| th().classes("text-xs px-4").child(col),
        }))),
    )
    .child(tbody().child(For(ForProps {
      each: move || tabs_store.select_active_editor_sql_result().unwrap().1,
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
