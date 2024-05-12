use crate::{
  enums::QueryTableLayout, grid_view::GridView, record_view::RecordView, store::tabs::TabsStore,
};
use leptos::*;

#[component]
pub fn QueryTable() -> impl IntoView {
  let tabs_store = expect_context::<TabsStore>();
  let table_view = expect_context::<RwSignal<QueryTableLayout>>();

  view! {
      <Show when=move || !tabs_store.is_loading.get() fallback=|| view! { <p>"Loading..."</p> }>
          {move || match tabs_store.select_active_editor_sql_result() {
              None => view! { <>"No data to display"</> },
              Some(_) => {
                  view! {
                      <>
                          {match table_view.get() {
                              QueryTableLayout::Grid => view! { <GridView/> },
                              QueryTableLayout::Records => view! { <RecordView/> },
                          }}
                      </>
                  }
              }
          }}

      </Show>
  }
}

