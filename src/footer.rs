use leptos::*;
use leptos_icons::*;

use crate::{enums::QueryTableLayout, store::active_project::ActiveProjectStore};

#[component]
pub fn Footer() -> impl IntoView {
  let table_view = expect_context::<RwSignal<QueryTableLayout>>();
  let acitve_project = expect_context::<ActiveProjectStore>();
  let sql_timer = expect_context::<RwSignal<f32>>();
  let formatted_timer = create_memo(move |_| format!("Query complete: {}ms", sql_timer.get()));

  view! {
      <footer class="flex flex-row justify-between items-center h-10 bg-gray-50 px-4">
          <div class="flex flex-row gap-2 text-xs">
              <Show when=move || acitve_project.0.get().is_some() fallback=|| view! { <div></div> }>
                  <div class="flex flex-row items-center gap-1">
                      <p>Selected project:</p>
                      <p class="font-semibold">{move || acitve_project.0.get()}</p>
                  </div>
              </Show>
          </div>
          <div class="flex flex-row gap-1 items-center text-xs">
              <p>{formatted_timer}</p>
              <button
                  class="p-1 hover:bg-gray-300 rounded-full"
                  class=("bg-gray-300", move || table_view() == QueryTableLayout::Records)
                  on:click=move |_| table_view.set(QueryTableLayout::Records)
              >

                  <Icon icon=icondata::HiBars4OutlineLg width="16" height="16"/>
              </button>
              <button
                  class="p-1 hover:bg-gray-300 rounded-full"
                  class=("bg-gray-300", move || table_view() == QueryTableLayout::Grid)
                  on:click=move |_| table_view.set(QueryTableLayout::Grid)
              >
                  <Icon icon=icondata::HiTableCellsOutlineLg width="16" height="16"/>
              </button>
          </div>
      </footer>
  }
}

