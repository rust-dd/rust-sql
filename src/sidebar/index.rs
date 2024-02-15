use common::enums::Project;
use leptos::*;
use leptos_use::{use_document, use_event_listener};
use tauri_sys::tauri::invoke;

use crate::{
  context_menu::siderbar::context_menu,
  hooks::use_context_menu,
  invoke::{Invoke, InvokeSelectProjectsArgs},
  modals::connection::Connection,
  store::projects::ProjectsStore,
};

use super::{project::Project, queries::Queries};

#[component]
pub fn Sidebar() -> impl IntoView {
  let projects_state = use_context::<ProjectsStore>().unwrap();
  let node_ref = use_context_menu::use_context_menu(context_menu);
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  create_resource(
    move || projects_state.0.get(),
    move |_| async move {
      let projects = invoke::<_, Vec<(String, Project)>>(
        &Invoke::select_projects.to_string(),
        &InvokeSelectProjectsArgs,
      )
      .await
      .unwrap();
      projects_state.set_projects(projects).unwrap()
    },
  );

  view! {
      <div
          _ref=node_ref
          classes="flex border-r-1 min-w-[320px] justify-between border-neutral-200 flex-col p-4"
      >
          <Connection show=show/>
          <div classes="flex flex-col overflow-auto">
              <div classes="flex flex-row justify-between items-center">
                  <p classes="font-semibold text-lg">Projects</p>
                  <button
                      classes="px-2 rounded-full hover:bg-gray-200"
                      on:click=move |_| show.set(true)
                  >
                      "+"
                  </button>
              </div>
              <For
                  each=move || projects_state.0.get()
                  key=|(project, _)| project.clone()
                  children=|(project, _)| view! { <Project project=project/> }
              />
          </div>
          <div classes="py-2">
              <p classes="font-semibold text-lg">Saved Queries</p>
              <div classes="text-sm">
                  <Queries/>
              </div>
          </div>
      </div>
  }
}

