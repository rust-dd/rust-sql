use leptos::*;
use leptos_use::{use_document, use_event_listener};

use crate::{
  databases::pgsql::index::Pgsql,
  modals::add_pgsql_connection::AddPgsqlConnection,
  store::{projects::ProjectsStore, queries::QueriesStore},
};
use common::enums::Drivers;

use super::queries::Queries;

#[component]
pub fn Sidebar() -> impl IntoView {
  let projects_store = expect_context::<ProjectsStore>();
  let queries_store = expect_context::<QueriesStore>();
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  let _ = create_resource(
    || {},
    move |_| async move {
      projects_store.load_projects().await;
      queries_store.load_queries().await;
    },
  );

  view! {
      <div class="flex border-r-1 min-w-[400px] justify-between border-neutral-200 flex-col p-4">
          <AddPgsqlConnection show=show/>
          <div class="flex flex-col overflow-auto">
              <div class="flex flex-row justify-between items-center">
                  <p class="font-semibold text-lg">Projects</p>
                  <button
                      class="px-2 rounded-full hover:bg-gray-200"
                      on:click=move |_| show.set(true)
                  >
                      "+"
                  </button>
              </div>
              <For
                  each=move || projects_store.0.get()
                  key=|(project, _)| project.clone()
                  children=|(project_id, project_details)| {
                      if project_details.contains(Drivers::PGSQL.as_ref()) {
                          view! {
                              <div>
                                  <Pgsql project_id/>
                              </div>
                          }
                      } else {
                          view! { <div></div> }
                      }
                  }
              />

          </div>
          <Show when=move || !queries_store.0.get().is_empty() fallback=|| view! { <div></div> }>
              <div class="py-2">
                  <p class="font-semibold text-lg">Saved Queries</p>
                  <div class="text-sm">
                      <Queries/>
                  </div>
              </div>
          </Show>
      </div>
  }
}

