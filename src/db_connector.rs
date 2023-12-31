use crate::store::{db::DBStore, query::QueryStore};
use leptos::{html::*, *};
use leptos_use::{use_document, use_event_listener};
use thaw::{Modal, ModalFooter, ModalProps};

pub fn db_connector() -> impl IntoView {
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  let (query_title, set_query_title) = create_signal(String::new());
  let db_state = use_context::<DBStore>().unwrap();
  let connect = create_action(move |db: &DBStore| {
    let db_clone = *db;
    async move { db_clone.connect().await }
  });
  let query_state = use_context::<QueryStore>().unwrap();
  let run_query = create_action(move |query_state: &QueryStore| {
    let query_state = *query_state;
    async move { query_state.run_query().await }
  });
  let insert_query = create_action(move |(query_db, key): &(QueryStore, String)| {
    let query_db_clone = *query_db;
    let key = key.clone();
    async move {
      query_db_clone.insert_query(key.as_str()).await.unwrap();
    }
  });

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
                                    insert_query.dispatch((query_state, query_title()));
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
                        .prop("value", move || db_state.project.get())
                        .on(ev::input, move |e| {
                            db_state.project.update(|prev| {
                                *prev = event_target_value(&e);
                            });
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db_state.db_user.get())
                        .prop("placeholder", "username")
                        .on(ev::input, move |e| {
                            db_state.db_user.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes( "border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "password")
                        .prop("value", move || db_state.db_password.get())
                        .prop("placeholder", "password")
                        .on(ev::input, move |e| {
                            db_state.db_password.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db_state.db_host.get())
                        .prop("placeholder", "host")
                        .on(ev::input, move |e| {
                            db_state.db_host.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db_state.db_port.get())
                        .prop("placeholder", "port")
                        .on(ev::input, move |e| {
                            db_state.db_port.set(event_target_value(&e));
                        }),
                ),
        )
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
                            db_state.is_connecting.get()
                                || db_state.db_host.get().is_empty()
                                || db_state.db_port.get().is_empty()
                                || db_state.db_user.get().is_empty()
                                || db_state.db_password.get().is_empty()
                        })
                        .on(ev::click, move |_| {
                            connect.dispatch(db_state);
                        })
                        .child("Connect"),
                ),
        )
}
