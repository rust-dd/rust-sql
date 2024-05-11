use common::enums::Drivers;
use leptos::*;
use tauri_sys::tauri::invoke;
use thaw::{Modal, ModalFooter};

use crate::{
  invoke::{Invoke, InvokeInsertProjectArgs},
  store::projects::ProjectsStore,
};

#[component]
pub fn Connection(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let (driver, _set_driver) = create_signal(Drivers::POSTGRESQL);
  let (project, set_project) = create_signal(String::new());
  let (db_user, set_db_user) = create_signal(String::new());
  let (db_password, set_db_password) = create_signal(String::new());
  let (db_host, set_db_host) = create_signal(String::new());
  let (db_port, set_db_port) = create_signal(String::new());
  //   let save_project = create_action(move |project_details: &Project| {
  //     let project_details = project_details.clone();
  //     async move {
  //       //   let project = invoke::<_, Project>(
  //       //     &Invoke::insert_project.to_string(),
  //       //     &InvokeInsertProjectArgs {
  //       //       project: project_details,
  //       //     },
  //       //   )
  //       //   .await
  //       //   .unwrap();
  //       //   projects_store.insert_project(project).unwrap();
  //       //   show.set(false);
  //     }
  //   });

  view! {
      <Modal show=show title="Add new project">
          <div class="flex flex-col gap-2">
              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  placeholder="project"
                  value=project
                  on:input=move |e| set_project(event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=db_user
                  placeholder="username"
                  on:input=move |e| set_db_user(event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="password"
                  value=db_password
                  placeholder="password"
                  on:input=move |e| set_db_password(event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=db_host
                  placeholder="host"
                  on:input=move |e| set_db_host(event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=db_port
                  placeholder="port"
                  on:input=move |e| set_db_port(event_target_value(&e))
              />
          </div>

          <ModalFooter slot>
              <div class="flex gap-2 justify-end">
                  <button
                      class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                      disabled=move || {
                          project().is_empty() || db_user().is_empty() || db_password().is_empty()
                              || db_host().is_empty() || db_port().is_empty()
                      }

                      on:click=move |_| {}
                  >

                      Add
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

