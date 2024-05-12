use leptos::*;

use crate::store::tabs::TabsStore;

#[component]
pub fn RecordView() -> impl IntoView {
  let tabs_store = expect_context::<TabsStore>();
  let columns = tabs_store.select_active_editor_sql_result().unwrap().0;
  let first_row = tabs_store
    .select_active_editor_sql_result()
    .unwrap()
    .1
    .first()
    .unwrap()
    .clone();
  let columns_with_values = columns.into_iter().zip(first_row).collect::<Vec<_>>();

  view! {
      <table class="table-auto w-full">
          <thead class="sticky top-0 bg-white">
              <tr class="bg-gray-100">
                  <th class="text-xs px 4">"Properties"</th>
                  <th class="text-xs px 4">"Values"</th>
              </tr>
          </thead>
          <tbody>
              <For
                  each=move || columns_with_values.clone()
                  key=|(col, _)| col.clone()
                  children=move |(col, val)| {
                      view! {
                          <tr class="hover:bg-gray-100 divide-x divide-gray-200">
                              <td class="px-4 text-xs bg-gray-200 font-semibold">{col}</td>
                              <td class="px-4 text-xs hover:bg-gray-100">{val}</td>
                          </tr>
                      }
                  }
              />

          </tbody>
      </table>
  }
}

