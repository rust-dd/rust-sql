use leptos::*;

use crate::store::{active_project::ActiveProjectStore, projects::ProjectsStore};

use super::schemas::Schemas;

#[component]
pub fn Project(project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let active_project_store = use_context::<ActiveProjectStore>().unwrap();
  let (show_schemas, set_show_schemas) = create_signal(false);
  let delete_project = create_action(move |(projects_store, project): &(ProjectsStore, String)| {
    let projects_store = *projects_store;
    let project = project.clone();
    async move {
      projects_store.delete_project(&project).await.unwrap();
    }
  });

  view! {
      <div class="pl-1 text-xs">
          <div class="flex flex-row justify-between items-center">
              <button
                  class="hover:font-semibold"
                  on:click={
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

