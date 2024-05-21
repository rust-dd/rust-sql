use leptos::*;
use thaw::{Modal, ModalFooter};

use crate::store::{atoms::PgsqlConnectionDetailsContext, projects::ProjectsStore};

#[component]
pub fn AddPgsqlConnection(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = expect_context::<ProjectsStore>();
  let params = expect_context::<PgsqlConnectionDetailsContext>();
  let save_project = create_action(
    move |(project_id, project_details): &(String, Vec<String>)| {
      let project_id = project_id.clone();
      let project_details = project_details.clone();
      async move {
        projects_store
          .insert_project(&project_id, project_details)
          .await;
        show.set(false);
      }
    },
  );

  view! {
      <Modal show=show title="Add new project">
          <div class="flex flex-col gap-2">
              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  placeholder="project"
                  value=params.get().project_id
                  on:input=move |e| {
                      params.update(move |p| p.project_id = event_target_value(&e))
                  }
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=params.get().user
                  placeholder="username"
                  on:input=move |e| params.update(|p| p.user = event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="password"
                  value=params.get().password
                  placeholder="password"
                  on:input=move |e| params.update(|p| p.password = event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=params.get().host
                  placeholder="host"
                  on:input=move |e| params.update(|p| p.host = event_target_value(&e))
              />

              <input
                  class="border-1 border-neutral-200 p-1 rounded-md"
                  type="text"
                  value=params.get().port
                  placeholder="port"
                  on:input=move |e| params.update(|p| p.port = event_target_value(&e))
              />
          </div>

          <ModalFooter slot>
              <div class="flex gap-2 justify-end">
                  <button
                      class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                      disabled=move || { params.get().into_iter().any(|v| v.is_empty()) }
                      on:click=move |_| {
                          save_project
                              .dispatch((
                                  params.get().project_id,
                                  vec![
                                      params.get().driver.to_string(),
                                      params.get().user,
                                      params.get().password,
                                      params.get().host,
                                      params.get().port,
                                  ],
                              ));
                      }
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

