use leptos::*;
use thaw::{Modal, ModalFooter};

use crate::store::{projects::ProjectsStore, queries::QueriesStore};

#[component]
pub fn AddCustomQuery(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = expect_context::<ProjectsStore>();
  let query_store = expect_context::<QueriesStore>();
  let (query_title, set_query_title) = create_signal(String::new());
  //let projects = create_memo(move |_| projects_store.get_projects().unwrap());

  let (project_name, set_project_name) = create_signal("".to_string());
  //   create_effect(move |_| {
  //     if !projects.get().is_empty() {
  //       set_project_name(projects.get()[0].clone());
  //     }
  //   });

  let insert_query = create_action(
    move |(query_db, key, project_name): &(QueriesStore, String, String)| {
      let query_db_clone = *query_db;
      let key = key.clone();
      let project_name = project_name.clone();
      async move {
        query_db_clone.insert_query(&key, &project_name).await;
      }
    },
  );

  view! {
      <Modal show=show title="Save query!">
          <div class="flex flex-col gap-2">
              <select
                  class="border-1 border-neutral-200 p-1 rounded-md w-full bg-white appearance-none"
                  value=project_name
                  default_value="teszt"
                  placeholder="Select project.."
              >// <For
              // each=move || projects.get()
              // key=|project| project.clone()
              // children=move |p| {
              // view! {
              // <option value=&p selected=project_name() == p>
              // {p}
              // </option>
              // }
              // }
              // />

              </select>
              <input
                  class="border-1 border-neutral-200 p-1 rounded-md w-full"
                  type="text"
                  placeholder="Add query name.."
                  value=query_title
                  on:input=move |e| set_query_title(event_target_value(&e))
              />
          </div>

          <ModalFooter slot>
              <div class="flex gap-2 justify-end">
                  <button
                      class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                      on:click=move |_| {
                          insert_query.dispatch((query_store, query_title(), project_name()));
                          show.set(false);
                      }
                  >

                      Save
                  </button>
                  <button
                      class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                      on:click=move |_| show.set(false)
                  >
                      Cancel
                  </button>
              </div>
          </ModalFooter>
      </Modal>
  }
}

