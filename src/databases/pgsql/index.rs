use std::rc::Rc;

use leptos::*;
use leptos_icons::*;
use leptos_toaster::{Toast, ToastId, ToastVariant, Toasts};

use super::{driver::Pgsql, schema::Schema};
use crate::{
  modals::add_pgsql_connection::AddPgsqlConnection,
  store::{projects::ProjectsStore, tabs::TabsStore},
};
use common::enums::ProjectConnectionStatus;

#[component]
pub fn Pgsql(project_id: String) -> impl IntoView {
  let project_id = Rc::new(project_id);
  let tabs_store = expect_context::<TabsStore>();
  let projects_store = expect_context::<ProjectsStore>();
  let project_details = projects_store.select_project_by_name(&project_id).unwrap();
  let project_details = Box::leak(Box::new(project_details));
  // [user, password, host, port]
  let mut pgsql = Pgsql::new(project_id.clone().to_string());
  {
    pgsql.load_connection_details(
      &project_details[1],
      &project_details[2],
      &project_details[3],
      &project_details[4],
      &project_details[5],
    );
  }
  let show = create_rw_signal(false);
  let toast_context = expect_context::<Toasts>();
  let create_toast = move |variant: ToastVariant, title: String| {
    let toast_id = ToastId::new();
    toast_context.toast(
      view! { <Toast toast_id variant title=view! { {title} }.into_view()/> },
      Some(toast_id),
      None, // options
    );
  };

  let connect = create_action(move |pgsql: &Pgsql| {
    let pgsql = *pgsql;
    async move {
      let status = pgsql.connector().await.unwrap();
      match status {
        ProjectConnectionStatus::Connected => {
          create_toast(ToastVariant::Success, "Connected to project".into());
        }
        ProjectConnectionStatus::Failed => {
          create_toast(ToastVariant::Error, "Failed to connect to project".into())
        }
        _ => create_toast(ToastVariant::Warning, "Failed to connect to project".into()),
      }
    }
  });
  let delete_project = create_action(
    move |(projects_store, project_id): &(ProjectsStore, String)| {
      let projects_store = *projects_store;
      let project_id = project_id.clone();
      async move {
        projects_store.delete_project(&project_id).await;
      }
    },
  );
  let connect = move || {
    if pgsql.status.get() == ProjectConnectionStatus::Connected {
      return;
    }
    connect.dispatch(pgsql);
  };

  view! {
      <Provider value=pgsql>
          <AddPgsqlConnection show=show/>
          <div class="pl-1 text-xs">
              <div class="flex flex-row justify-between items-center">
                  <button
                      class="hover:font-semibold flex flex-row items-center gap-1 disabled:opacity-50 disabled:font-normal"
                      disabled=move || { pgsql.status.get() == ProjectConnectionStatus::Connecting }
                      on:click=move |_| connect()
                  >

                      {move || match pgsql.status.get() {
                          ProjectConnectionStatus::Connected => {
                              view! {
                                  <Icon
                                      icon=icondata::HiCheckCircleOutlineLg
                                      width="12"
                                      height="12"
                                  />
                              }
                          }
                          ProjectConnectionStatus::Connecting => {
                              view! {
                                  <Icon
                                      icon=icondata::HiArrowPathOutlineLg
                                      class="animate-spin"
                                      width="12"
                                      height="12"
                                  />
                              }
                          }
                          _ => {
                              view! {
                                  <Icon icon=icondata::HiXCircleOutlineLg width="12" height="12"/>
                              }
                          }
                      }}

                      {pgsql.project_id}
                  </button>
                  <div>
                      <button
                          class="p-1 rounded-full hover:bg-gray-200"
                          on:click={
                              let project_id = project_id.clone();
                              move |_| {
                                  tabs_store.add_tab(&project_id);
                                  connect();
                              }
                          }
                      >

                          <Icon icon=icondata::HiCircleStackOutlineLg width="12" height="12"/>
                      </button>
                      <button
                          class="p-1 rounded-full hover:bg-gray-200"
                          on:click=move |_| {
                              pgsql.edit_connection_details();
                              show.set(true);
                          }
                      >

                          <Icon icon=icondata::HiPencilSquareOutlineLg width="12" height="12"/>
                      </button>
                      <button
                          class="p-1 rounded-full hover:bg-gray-200"
                          on:click={
                              let project_id = project_id.clone();
                              move |_| {
                                  delete_project
                                      .dispatch((projects_store, project_id.clone().to_string()));
                              }
                          }
                      >

                          <Icon icon=icondata::HiTrashOutlineLg width="12" height="12"/>
                      </button>
                  </div>
              </div>
              <div class="pl-4">
                  <Show when=move || !pgsql.schemas.get().is_empty() fallback=|| view! {}>
                      <For
                          each=move || pgsql.schemas.get()
                          key=|schema| schema.clone()
                          children=move |schema| {
                              view! { <Schema schema=schema/> }
                          }
                      />

                  </Show>
              </div>
          </div>
      </Provider>
  }
}

