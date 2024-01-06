use common::{
  drivers::postgresql::Postgresql as PostgresqlDriver,
  enums::{Drivers, Project},
  projects::postgresql::Postgresql,
};
use leptos::{html::*, *};
use thaw::{Modal, ModalFooter, ModalProps};

use crate::{
  invoke::{Invoke, InvokeInsertProjectArgs},
  store::projects::ProjectsStore,
  wasm_functions::invoke,
};

pub fn component(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let (driver, _set_driver) = create_signal(Drivers::POSTGRESQL);
  let (project, set_project) = create_signal(String::new());
  let (db_user, set_db_user) = create_signal(String::new());
  let (db_password, set_db_password) = create_signal(String::new());
  let (db_host, set_db_host) = create_signal(String::new());
  let (db_port, set_db_port) = create_signal(String::new());
  let save_project = create_action(move |project_details: &Project| {
    let project_details = project_details.clone();
    async move {
      let args = serde_wasm_bindgen::to_value(&InvokeInsertProjectArgs {
        project: project_details,
      })
      .unwrap();
      let project = invoke(&Invoke::insert_project.to_string(), args).await;
      let project = serde_wasm_bindgen::from_value::<Project>(project).unwrap();
      projects_store.insert_project(project).unwrap();
      show.set(false);
    }
  });

  Modal(ModalProps {
    show,
    title: MaybeSignal::Static(String::from("Add new project")),
    children: Children::to_children(move || {
      Fragment::new(vec![div()
        .classes("flex flex-col gap-2")
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md")
            .prop("type", "text")
            .prop("placeholder", "project")
            .prop("value", project)
            .on(ev::input, move |e| set_project(event_target_value(&e))),
        )
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md")
            .prop("type", "text")
            .prop("value", db_user)
            .prop("placeholder", "username")
            .on(ev::input, move |e| set_db_user(event_target_value(&e))),
        )
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md")
            .prop("type", "password")
            .prop("value", db_password)
            .prop("placeholder", "password")
            .on(ev::input, move |e| set_db_password(event_target_value(&e))),
        )
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md")
            .prop("type", "text")
            .prop("value", db_host)
            .prop("placeholder", "host")
            .on(ev::input, move |e| set_db_host(event_target_value(&e))),
        )
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md")
            .prop("type", "text")
            .prop("value", db_port)
            .prop("placeholder", "port")
            .on(ev::input, move |e| set_db_port(event_target_value(&e))),
        )
        .into_view()])
    }),
    modal_footer: Some(ModalFooter {
      children: ChildrenFn::to_children(move || {
        Fragment::new(vec![div()
          .classes("flex gap-2 justify-end")
          .child(
            button()
              .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
              .child("Add")
              .prop("disabled", move || {
                project().is_empty()
                  || db_user().is_empty()
                  || db_password().is_empty()
                  || db_host().is_empty()
                  || db_port().is_empty()
              })
              .on(ev::click, move |_| {
                let project_details = match driver() {
                  Drivers::POSTGRESQL => Project::POSTGRESQL(Postgresql {
                    name: project(),
                    driver: PostgresqlDriver::new(db_user(), db_password(), db_host(), db_port()),
                    ..Postgresql::default()
                  }),
                };
                save_project.dispatch(project_details);
              }),
          )
          .child(
            button()
              .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
              .child("Cancel")
              .on(ev::click, move |_| show.set(false)),
          )
          .into_view()])
      }),
    }),
  })
}
