use crate::store::{db::DBStore, editor::EditorState, query::QueryState};
use leptos::*;

#[component]
pub fn Tables(schema: String) -> impl IntoView {
    let mut db = use_context::<DBStore>().unwrap();
    let query_store = use_context::<QueryState>().unwrap();
    let tables = create_resource(
        || {},
        move |_| {
            let schema = schema.clone();
            async move { db.get_tables(schema).await.unwrap() }
        },
    );

    view! {
        <Suspense fallback=|| view! { <p class="pl-2">Loading...</p> }>
            <Show
                when=move || !tables.get().unwrap_or_default().is_empty()
                fallback=|| view! { <p class="pl-2">No tables found</p> }
            >
                {move || {
                    tables
                        .get()
                        .unwrap_or_default()
                        .into_iter()
                        .enumerate()
                        .map(|(i, (table, is_selected))| {
                            let table_clone = table.clone();
                            view! {
                                <li
                                    key=i
                                    class=if is_selected {
                                        "pl-4 font-semibold"
                                    } else {
                                        "hover:font-semibold pl-4"
                                    }

                                    on:click=move |_| {
                                        let schema = db
                                            .schemas
                                            .get_untracked()
                                            .iter()
                                            .find(|(_, is_selected)| **is_selected)
                                            .unwrap()
                                            .0
                                            .clone();
                                        let t_clone = table_clone.clone();
                                        spawn_local(async move {
                                            let editor = use_context::<EditorState>()
                                                .unwrap()
                                                .editor
                                                .get_untracked();
                                            editor
                                                .borrow()
                                                .as_ref()
                                                .unwrap()
                                                .get_model()
                                                .unwrap()
                                                .set_value(
                                                    &format!("SELECT * FROM {}.{} LIMIT 100;", schema, t_clone),
                                                );
                                            query_store.run_query().await;
                                        });
                                        let table_clone = table_clone.clone();
                                        tables
                                            .update(move |prev| {
                                                prev.iter_mut()
                                                    .for_each(|tables| {
                                                        tables
                                                            .iter_mut()
                                                            .for_each(|(t, s)| {
                                                                *s = t == &table_clone;
                                                            });
                                                    });
                                            });
                                    }
                                >

                                    {table}
                                </li>
                            }
                        })
                        .collect_view()
                }}

            </Show>
        </Suspense>
    }
}

