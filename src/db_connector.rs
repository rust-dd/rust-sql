use leptos::{html::*, *};

use crate::store::{db::DBStore, query::QueryState};

pub fn db_connector() -> impl IntoView {
  let db = use_context::<DBStore>().unwrap();
  let connect = create_action(move |db: &DBStore| {
    let db_clone = *db;
    async move { db_clone.connect().await }
  });
  let query_state = use_context::<QueryState>().unwrap();
  let run_query = create_action(move |query_state: &QueryState| {
    let query_state = *query_state;
    async move { query_state.run_query().await }
  });

  header()
        .classes("flex flex-row justify-between p-4 gap-2 border-b-1 border-neutral-200")
        .child(
            div()
                .classes("flex flex-row gap-2")
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("placeholder", "project")
                        .prop("value", move || db.project.get())
                        .on(ev::input, move |e| {
                            db.project.update(|prev| {
                                *prev = event_target_value(&e);
                            });
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db.db_user.get())
                        .prop("placeholder", "username")
                        .on(ev::input, move |e| {
                            db.db_user.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes( "border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "password")
                        .prop("value", move || db.db_password.get())
                        .prop("placeholder", "password")
                        .on(ev::input, move |e| {
                            db.db_password.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db.db_host.get())
                        .prop("placeholder", "host")
                        .on(ev::input, move |e| {
                            db.db_host.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .classes("border-1 border-neutral-200 p-1 rounded-md")
                        .prop("type", "text")
                        .prop("value", move || db.db_port.get())
                        .prop("placeholder", "port")
                        .on(ev::input, move |e| {
                            db.db_port.set(event_target_value(&e));
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
                            db.is_connecting.get()
                                || db.db_host.get().is_empty()
                                || db.db_port.get().is_empty()
                                || db.db_user.get().is_empty()
                                || db.db_password.get().is_empty()
                        })
                        .on(ev::click, move |_| {
                            connect.dispatch(db);
                        })
                        .child("Connect"),
                ),
        )
}
