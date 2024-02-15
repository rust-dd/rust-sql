use crate::{
  enums::QueryTableLayout, grid_view::GridView, record_view::RecordView, store::tabs::TabsStore,
};
use leptos::*;

#[component]
pub fn QueryTable() -> impl IntoView {
  let tabs_store = use_context::<TabsStore>().unwrap();
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();

  view! {
      <Show when=move || !tabs_store.is_loading.get() fallback=|| view! { <p>"Loading..."</p> }>
          {move || match tabs_store.select_active_editor_sql_result() {
              None => view! { <p>"No data to display"</p> },
              Some(_) => {
                  match table_view.get() {
                      QueryTableLayout::Grid => view! { <GridView/> },
                      QueryTableLayout::Record => view! { <RecordView/> },
                  }
              }
          }}

      </Show>
  }
}

