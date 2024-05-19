use leptos::*;
use leptos_icons::*;

use crate::{
  enums::QueryTableLayout,
  grid_view::GridView,
  record_view::RecordView,
  store::{atoms::RunQueryContext, tabs::TabsStore},
};

#[component]
pub fn QueryTable() -> impl IntoView {
  let tabs_store = expect_context::<TabsStore>();
  let table_view = expect_context::<RwSignal<QueryTableLayout>>();
  let is_query_running = expect_context::<RunQueryContext>();

  view! {
      <Show
          when=move || !is_query_running.get().is_running
          fallback=|| {
              view! {
                  <div class="flex items-center justify-center p-2 w-full h-full">
                      <Icon
                          icon=icondata::HiArrowPathOutlineLg
                          class="animate-spin"
                          width="18"
                          height="18"
                      />
                      <p class="ml-2">"Running query..."</p>
                  </div>
              }
          }
      >

          {move || match tabs_store.select_active_editor_sql_result() {
              None => {
                  view! {
                      <div class="flex items-center justify-center p-2 w-full">
                          "No data to display"
                      </div>
                  }
              }
              Some(_) => {
                  view! {
                      <div>
                          {match table_view.get() {
                              QueryTableLayout::Grid => view! { <GridView/> },
                              QueryTableLayout::Records => view! { <RecordView/> },
                          }}

                      </div>
                  }
              }
          }}

      </Show>
  }
}

