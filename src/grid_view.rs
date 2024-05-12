use leptos::*;

use crate::store::tabs::TabsStore;

#[component]
pub fn GridView() -> impl IntoView {
  let tabs_store = expect_context::<TabsStore>();

  view! {
      <table class="table-auto w-full">
          <thead class="sticky top-0 bg-white">
              <tr class="bg-gray-100">
                  <For
                      each=move || tabs_store.select_active_editor_sql_result().unwrap().0
                      key=|n| n.clone()
                      children=move |col| {
                          view! { <th class="text-xs px 4">{col}</th> }
                      }
                  />

              </tr>
          </thead>
          <tbody>
              <For
                  each=move || tabs_store.select_active_editor_sql_result().unwrap().1
                  key=|n| n.clone()
                  children=move |row| {
                      view! {
                          <tr class="hover:bg-gray-100 divide-x divide-gray-200">
                              <For
                                  each=move || row.clone()
                                  key=|n| n.clone()
                                  children=move |cell| {
                                      view! { <td class="px-4 text-xs cursor:pointer">{cell}</td> }
                                  }
                              />

                          </tr>
                      }
                  }
              />

          </tbody>
      </table>
  }
}

