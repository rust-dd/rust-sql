use common::enums::Project;
use leptos::{html::*, IntoView, *};
use leptos_use::{use_document, use_event_listener};
use tauri_sys::tauri::invoke;

use crate::{
  context_menu::siderbar::context_menu,
  hooks::use_context_menu,
  invoke::{Invoke, InvokeSelectProjectsArgs},
  modals,
  store::projects::ProjectsStore,
};

use super::{project, queries};

pub fn component() -> impl IntoView {
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

  div()
    .node_ref(node_ref)
    .classes("flex border-r-1 min-w-[320px] justify-between border-neutral-200 flex-col p-4")
    .child(modals::connection::component(show))
    .child(
      div().classes("flex flex-col overflow-auto").child(
        div()
          .child(
            div()
              .classes("flex flex-row justify-between items-center")
              .child(p().classes("font-semibold text-lg").child("Projects"))
              .child(
                button()
                  .classes("px-2 rounded-full hover:bg-gray-200")
                  .child("+")
                  .on(ev::click, move |_| show.set(true)),
              ),
          )
          .child(For(ForProps {
            each: move || projects_state.0.get(),
            key: |(project, _)| project.clone(),
            children: |(project, _)| project::component(project),
          })),
      ),
    )
    .child(
      div()
        .classes("py-2")
        .child(p().classes("font-semibold text-lg").child("Saved Queries"))
        .child(div().classes("text-sm").child(queries::component())),
    )
}
