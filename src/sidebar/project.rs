use leptos::{logging::log, *};
use leptos_icons::*;

use crate::{
  app::ErrorModal,
  modals::error::Error as Modal,
  store::{active_project::ActiveProjectStore, projects::ProjectsStore},
};

use super::schemas::Schemas;

#[component]
pub fn Project(project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let active_project_store = use_context::<ActiveProjectStore>().unwrap();
  let error_modal = use_context::<ErrorModal>().unwrap();
  let (show_schemas, set_show_schemas) = create_signal(false);
  let delete_project = create_action(move |(projects_store, project): &(ProjectsStore, String)| {
    let projects_store = *projects_store;
    let project = project.clone();
    async move {
      projects_store.delete_project(&project).await.unwrap();
    }
  });

  let on_click = move || {
    error_modal.show.update(|prev| *prev = false);
    set_show_schemas(false);
    active_project_store.0.set(None);
  };

  view! {
      <div class="pl-1 text-xs">
          <Modal show=error_modal.show message=error_modal.message on_click=on_click/>
          <div class="flex flex-row justify-between items-center">
              <button
                  class="hover:font-semibold"
                  on:click={
                      log!("project: {}", error_modal.show.get());
                      let project = project.clone();
                      move |_| {
                          active_project_store.0.set(Some(project.clone()));
                          set_show_schemas(!show_schemas());
                      }
                  }
              >

                  {&project}
              </button>
              <button
                  class="px-2 rounded-full hover:bg-gray-200"
                  on:click={
                      let project = project.clone();
                      move |_| {
                          delete_project.dispatch((projects_store, project.clone()));
                      }
                  }
              >

                  "-"
              </button>
          </div>
          <div class="pl-1">
              <Suspense fallback=move || {
                  view! { <p>Loading...</p> }
              }>

                  {
                      let project = project.clone();
                      view! {
                          <Show when=show_schemas fallback=|| view! {}>
                              <Schemas project=project.clone()/>
                          </Show>
                      }
                  }

              </Suspense>
          </div>
      </div>
  }
}

