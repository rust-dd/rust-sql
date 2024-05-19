use std::sync::Arc;

use leptos::*;
use leptos_icons::*;

use crate::store::{queries::QueriesStore, tabs::TabsStore};

#[component]
pub fn Query(query_id: String, sql: String) -> impl IntoView {
  let query_id = Arc::new(query_id);
  let sql = Arc::new(sql);
  let query_store = expect_context::<QueriesStore>();
  let tabs_store = expect_context::<TabsStore>();

  view! {
      <div class="flex flex-row justify-between items-center">
          <button
              class="hover:font-semibold"
              on:click={
                  let query_id = query_id.clone();
                  let sql = sql.clone();
                  move |_| {
                      let query_id = query_id.clone();
                      let sql = sql.clone();
                      spawn_local(async move {
                          tabs_store.load_query(&query_id, &sql).await;
                      })
                  }
              }
          >

              <div class="flex flex-row items-center gap-1">
                  <Icon icon=icondata::HiCircleStackOutlineLg width="12" height="12"/>
                  {&*query_id}
              </div>
          </button>
          <button
              class="p-1 rounded-full hover:bg-gray-200"
              on:click={
                  let query_id = query_id.clone();
                  move |_| {
                      let query_id = query_id.clone();
                      spawn_local(async move {
                          query_store.delete_query(&query_id).await;
                      })
                  }
              }
          >

              <Icon icon=icondata::HiTrashOutlineLg width="12" height="12"/>
          </button>
      </div>
  }
}

