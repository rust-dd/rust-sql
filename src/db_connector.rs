use leptos::*;

use crate::store::db::DBStore;

#[component]
pub fn DBConnector() -> impl IntoView {
    let db = use_context::<DBStore>().unwrap();
    let connect = create_action(move |db: &DBStore| {
        let mut db_clone = *db;
        async move {
            db_clone.connect().await;
        }
    });

    view! {
        <div class="flex flex-row justify-between p-4 gap-2 border-b-1 border-neutral-200">
            <div class="flex flex-row gap-2">
                <input
                    class="border-1 border-neutral-200 p-1 rounded-md"
                    type="text"
                    value=move || db.db_user.get()
                    placeholder="username"
                    on:input=move |e| {
                        db.db_user.set(event_target_value(&e));
                    }
                />

                <input
                    class="border-1 border-neutral-200 p-1 rounded-md"
                    type="password"
                    value=move || db.db_password.get()
                    placeholder="password"
                    on:input=move |e| {
                        db.db_password.set(event_target_value(&e));
                    }
                />

                <input
                    class="border-1 border-neutral-200 p-1 rounded-md"
                    type="text"
                    value=move || db.db_host.get()
                    placeholder="host"
                    on:input=move |e| {
                        db.db_host.set(event_target_value(&e));
                    }
                />

                <input
                    class="border-1 border-neutral-200 p-1 rounded-md"
                    type="text"
                    value=move || db.db_port.get()
                    placeholder="port"
                    on:input=move |e| {
                        db.db_port.set(event_target_value(&e));
                    }
                />

            </div>
            <button
                class="px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md"
                on:click=move |_| {
                    connect.dispatch(db);
                }
            >

                Connect
            </button>
        </div>
    }
}

