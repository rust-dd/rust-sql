use leptos::*;
use leptos_icons::*;

use crate::enums::QueryTableLayout;

#[component]
pub fn Footer() -> impl IntoView {
  let table_view = expect_context::<RwSignal<QueryTableLayout>>();

  view! {
      <footer class="flex flex-row justify-end items-center h-10 bg-gray-50 px-4 gap-1">
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
      </footer>
  }
}

