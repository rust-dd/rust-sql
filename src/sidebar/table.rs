use std::sync::Arc;

use futures::lock::Mutex;
use leptos::*;
use leptos_icons::*;

use crate::store::{active_project::ActiveProjectStore, tabs::TabsStore};

#[component]
pub fn Table(table: (String, String), project: String, schema: String) -> impl IntoView {
  let tabs_store = Arc::new(Mutex::new(use_context::<TabsStore>().unwrap()));
  let active_project = use_context::<ActiveProjectStore>().unwrap();
  let query = create_action(
    move |(schema, table, tabs_store): &(String, String, Arc<Mutex<TabsStore>>)| {
      let tabs_store = tabs_store.clone();
      let project = project.clone();
      let schema = schema.clone();
      let table = table.clone();
      active_project.0.set(Some(project.clone()));

      async move {
        tabs_store
          .lock()
          .await
          .set_editor_value(&format!("SELECT * FROM {}.{} LIMIT 100;", schema, table));
        tabs_store.lock().await.run_query().await.unwrap()
      }
    },
  );

  view! {
      <div
          class="flex flex-row justify-between items-center hover:font-semibold cursor-pointer"
          on:click={
              let table = table.clone();
              move |_| { query.dispatch((schema.clone(), table.0.clone(), tabs_store.clone())) }
          }
      >

          <div class="flex flex-row items-center gap-1">
              <Icon icon=icondata::HiTableCellsOutlineLg width="12" height="12"/>
              <p>{table.0}</p>
          </div>
          <p>{table.1}</p>
      </div>
  }
}

