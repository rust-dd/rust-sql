use crate::{store::db::DBStore, tables::Tables};
use leptos::*;

#[component]
pub fn Sidebar() -> impl IntoView {
    let db = use_context::<DBStore>().unwrap();

    view! {
        <header class="flex border-r-1 border-neutral-200 flex-col gap-2 px-4 pt-4">
            <p class="font-semibold">Schemas</p>
            <div class="pl-2">
                <Show when=move || db.is_connecting.get()>
                    <p>Loading...</p>
                </Show>
                {move || {
                    db.schemas
                        .get()
                        .into_iter()
                        .map(|(schema, toggle)| {
                            let s = schema.clone();
                            view! {
                                <div key=&schema>
                                    <button
                                        class=if toggle {
                                            "font-semibold"
                                        } else {
                                            "hover:font-semibold"
                                        }

                                        on:click=move |_| {
                                            let s_clone = s.clone();
                                            db.schemas
                                                .update(|prev| {
                                                    prev.insert(s_clone, !toggle);
                                                });
                                        }
                                    >

                                        {&schema}
                                    </button>
                                    <Show when=move || toggle>
                                        <Tables schema=schema.clone()/>
                                    </Show>
                                </div>
                            }
                        })
                        .collect_view()
                }}

            </div>
        </header>
    }
}

