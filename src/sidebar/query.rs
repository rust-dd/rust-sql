use leptos::*;
use leptos_icons::*;

use crate::store::{query::QueryStore, tabs::TabsStore};

#[component]
pub fn Query(key: String) -> impl IntoView {
  let query_store = use_context::<QueryStore>().unwrap();
  let tabs_store = use_context::<TabsStore>().unwrap();
  let key_clone = key.clone();
  let splitted_key = create_memo(move |_| {
    let key = key_clone.clone();

    key
      .split(':')
      .map(|s| s.to_string())
      .collect::<Vec<String>>()
  });

  view! {
      <div class="flex flex-row justify-between items-center">
          <button
              class="hover:font-semibold"
              on:click={
                  let key = key.clone();
                  move |_| {
                      tabs_store.load_query(&key).unwrap();
                  }
              }
          >

              <div class="flex flex-row items-center gap-1">
                  <Icon icon=icondata::HiCircleStackOutlineLg width="12" height="12"/>
                  {splitted_key.clone().get()[1].clone()}
              </div>
          </button>
          <button
              class="px-2 rounded-full hover:bg-gray-200"
              on:click={
                  let key = key.clone();
                  move |_| {
                      let key = key.clone();
                      spawn_local(async move {
                          query_store.delete_query(&key).await.unwrap();
                      })
                  }
              }
          >

              "-"
          </button>
      </div>
  }
}

