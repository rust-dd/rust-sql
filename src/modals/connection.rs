use leptos::{html::*, *};
use thaw::{Modal, ModalFooter, ModalProps};

pub fn component(show: RwSignal<bool>) -> impl IntoView {
  let (project, set_project) = create_signal(String::new());
  let (db_user, set_db_user) = create_signal(String::new());
  let (db_password, set_db_password) = create_signal(String::new());
  let (db_host, set_db_host) = create_signal(String::new());
  let (db_port, set_db_port) = create_signal(String::new());

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
              .on(ev::click, move |_| {}),
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
