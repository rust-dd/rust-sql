use std::rc::Rc;

use common::enums::Drivers;
use leptos::*;
use thaw::{Modal, ModalFooter};

use crate::store::queries::QueriesStore;

#[component]
pub fn AddCustomQuery(
  show: RwSignal<bool>,
  project_id: String,
  driver: Drivers,
  database: String,
) -> impl IntoView {
  let project_id = Rc::new(project_id);
  let project_id_clone = project_id.clone();
  let query_store = expect_context::<QueriesStore>();
  let (title, set_title) = create_signal(String::new());
  let insert_query = create_action(
    move |(query_db, project_id, title, driver, database): &(
      QueriesStore,
      String,
      String,
      Drivers,
      String,
    )| {
      let query_db_clone = *query_db;
      let project_id = project_id.clone();
      let title = title.clone();
      let driver = *driver;
      let database = database.clone();
      async move {
        query_db_clone
          .insert_query(&project_id, &title, &driver, &database)
          .await;
      }
    },
  );

  view! {
      <Modal show=show title="Save query!">
          <div class="flex flex-col gap-2">
              <p>Project: {&*project_id_clone}</p>
              <input
                  class="border-1 border-neutral-200 p-1 rounded-md w-full"
                  type="text"
                  placeholder="Add query name.."
                  value=title
                  on:input=move |e| set_title(event_target_value(&e))
              />
          </div>

          <ModalFooter slot>
              <div class="flex gap-2 justify-end">
                  <button
                      class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                      on:click={
                          let project_id = project_id.clone();
                          let database = database.clone();
                          move |_| {
                              insert_query
                                  .dispatch((
                                      query_store,
                                      project_id.to_string(),
                                      title(),
                                      driver,
                                      database.to_string(),
                                  ));
                              show.set(false);
                          }
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

