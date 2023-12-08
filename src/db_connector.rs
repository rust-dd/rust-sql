use leptos::{html::*, *};

use crate::store::{db::DBStore, query::QueryState};

pub fn db_connector() -> impl IntoView {
    let db = use_context::<DBStore>().unwrap();
    let connect = create_action(move |db: &DBStore| {
        let mut db_clone = *db;
        async move { db_clone.connect().await }
    });
    let query_state = use_context::<QueryState>().unwrap();
    let run_query = create_action(move |query_state: &QueryState| {
        let query_state = *query_state;
        async move { query_state.run_query().await }
    });

    header()
        .attr(
            "class",
            "flex flex-row justify-between p-4 gap-2 border-b-1 border-neutral-200",
        )
        .child(
            div()
                .attr("class", "flex flex-row gap-2")
                .child(
                    input()
                        .attr("class", "border-1 border-neutral-200 p-1 rounded-md")
                        .attr("type", "text")
                        .attr("value", move || db.db_user.get())
                        .attr("placeholder", "username")
                        .on(ev::input, move |e| {
                            db.db_user.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .attr("class", "border-1 border-neutral-200 p-1 rounded-md")
                        .attr("type", "password")
                        .attr("value", move || db.db_password.get())
                        .attr("placeholder", "password")
                        .on(ev::input, move |e| {
                            db.db_password.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .attr("class", "border-1 border-neutral-200 p-1 rounded-md")
                        .attr("type", "text")
                        .attr("value", move || db.db_host.get())
                        .attr("placeholder", "host")
                        .on(ev::input, move |e| {
                            db.db_host.set(event_target_value(&e));
                        }),
                )
                .child(
                    input()
                        .attr("class", "border-1 border-neutral-200 p-1 rounded-md")
                        .attr("type", "text")
                        .attr("value", move || db.db_port.get())
                        .attr("placeholder", "port")
                        .on(ev::input, move |e| {
                            db.db_port.set(event_target_value(&e));
                        }),
                ),
        )
        .child(
            div()
                .attr("class", "flex flex-row gap-2")
                .child(
                    button()
                        .attr(
                            "class",
                            "px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md",
                        )
                        .on(ev::click, move |_| run_query.dispatch(query_state))
                        .child("Query"),
                )
                .child(
                    button()
                        .attr(
                            "class",
                            "px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md",
                        )
                        .on(ev::click, move |_| {
                            connect.dispatch(db);
                        })
                        .child("Connect"),
                ),
        )
}

