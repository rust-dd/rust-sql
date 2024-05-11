use leptos::*;
use leptos_use::{use_document, use_event_listener};
use tauri_sys::tauri::invoke;

use crate::{
  driver_components::pgsql::Pgsql,
  invoke::{Invoke, InvokeSelectProjectsArgs},
  modals::connection::Connection,
  store::projects::ProjectsStore,
};

use super::{project::Project, queries::Queries};

#[component]
pub fn Sidebar() -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  create_resource(
    move || projects_store.0.get(),
    move |_| async move {
      projects_store.load_projects().await;
    },
  );

  view! {
      <div class="flex border-r-1 min-w-[320px] justify-between border-neutral-200 flex-col p-4">
          <Connection show=show/>
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
                  children=|(project_id, _)| view! { <Pgsql project_id=project_id/> }
              />
          </div>
          <div class="py-2">
              <p class="font-semibold text-lg">Saved Queries</p>
              <div class="text-sm">
                  <Queries/>
              </div>
          </div>
      </div>
  }
}

