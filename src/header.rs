// use crate::store::query::QueryStore;
use leptos::{html::*, *};
use leptos_use::{use_document, use_event_listener};
use thaw::{Modal, ModalFooter, ModalProps};

use crate::store::{projects::ProjectsStore, query::QueryStore};

#[allow(dead_code)]
pub fn component() -> impl IntoView {
  let (project, set_project) = create_signal(String::new());
  let (db_user, set_db_user) = create_signal(String::new());
  let (db_password, set_db_password) = create_signal(String::new());
  let (db_host, set_db_host) = create_signal(String::new());
  let (db_port, set_db_port) = create_signal(String::new());
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  let (query_title, set_query_title) = create_signal(String::new());
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let connect = create_action(move |(projects_store, project): &(ProjectsStore, String)| {
    let projects_store = *projects_store;
    let project = project.clone();
    async move { projects_store.connect(&project).await }
  });
  let query_state = use_context::<QueryStore>().unwrap();
  let run_query = create_action(move |query_state: &QueryStore| {
    let query_state = *query_state;
    async move { query_state.run_query().await }
  });
  let insert_query = create_action(
    move |(query_db, key, project): &(QueryStore, String, String)| {
      let query_db_clone = *query_db;
      let key = key.clone();
      let project = project.clone();
      async move {
        query_db_clone
          .insert_query(&key, &project)
          .await
          .unwrap();
      }
    },
  );

  header()
          .classes("flex flex-row justify-between p-4 gap-2 border-b-1 border-neutral-200")
          .child(
              div()
              .child(Modal(ModalProps {
                      show,
                      title: MaybeSignal::derive(move || String::from("Save query!")),
                      children: Children::to_children(move || Fragment::new(vec![
                          div()
                          .child(
                              input()
                              .classes("border-1 border-neutral-200 p-1 rounded-md w-full")
                              .prop("type", "text")
                              .prop("placeholder", "Add query name..")
                              .prop("value", query_title)
                              .on(ev::input, move |e| {
                                  set_query_title(event_target_value(&e));
                              })
                          )
                          .into_view()
                          ])),
                      modal_footer: Some(ModalFooter {
                          children: ChildrenFn::to_children(move || Fragment::new(vec![
                              div()
                              .classes("flex gap-2")
                              .attr("style", "justify-content: flex-end")
                              .child(
                                  button()
                                  .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
                                  .on(ev::click, move |_| {
                                      insert_query.dispatch((query_state, query_title(), project()));
                                      show.set(false);
                                  })
                                  .child("Save")
                              )
                              .child(
                                  button()
                                  .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
                                  .on(ev::click, move |_| {
                                      show.set(false)
                                  })
                                  .child("Cancel")
                              ).into_view(),
                          ])),
                      })
                  }))
                  .classes("flex flex-row gap-2")
                  .child(
                      input()
                          .classes("border-1 border-neutral-200 p-1 rounded-md")
                          .prop("type", "text")
                          .prop("placeholder", "project")
                          .prop("value", project)
                          .on(ev::input, move |e| set_project(event_target_value(&e)))
                  )
                  .child(
                      input()
                          .classes("border-1 border-neutral-200 p-1 rounded-md")
                          .prop("type", "text")
                          .prop("value", db_user)
                          .prop("placeholder", "username")
                          .on(ev::input, move |e| set_db_user(event_target_value(&e)),
                  ))
                  .child(
                      input()
                          .classes( "border-1 border-neutral-200 p-1 rounded-md")
                          .prop("type", "password")
                          .prop("value", db_password)
                          .prop("placeholder", "password")
                          .on(ev::input, move |e| set_db_password(event_target_value(&e)))
                  )
                  .child(
                      input()
                          .classes("border-1 border-neutral-200 p-1 rounded-md")
                          .prop("type", "text")
                          .prop("value", db_host)
                          .prop("placeholder", "host")
                          .on(ev::input, move |e|   set_db_host(event_target_value(&e))
                          ),
                  )
                  .child(
                      input()
                          .classes("border-1 border-neutral-200 p-1 rounded-md")
                          .prop("type", "text")
                          .prop("value", db_port)
                          .prop("placeholder", "port")
                          .on(ev::input, move |e| 
                          
                              set_db_port(event_target_value(&e))
                          ),
                  ))
          .child(
              div()
                  .classes("flex flex-row gap-2")
                  .child(
                      button()
                          .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
                          .on(ev::click, move |_| {
                              show.set(true)
                          })
                          .child("Save Query"),
                  )
                  .child(
                      button()
                          .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
                          .on(ev::click, move |_| run_query.dispatch(query_state))
                          .child("Query"),
                  )
                  .child(
                      button()
                          .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md disabled:opacity-50").prop("disabled", move || {
                               db_host().is_empty()
                                  || db_port().is_empty()
                                  || db_user().is_empty()
                                  || db_password().is_empty()
                          })
                          .on(ev::click, move |_| {
                              connect.dispatch((projects_store, project()));
                          })
                          .child("Connect"),
                  ),
          )
}
