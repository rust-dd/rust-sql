use crate::store::db::DBStore;
use leptos::*;

#[component]
pub fn Tables(schema: String) -> impl IntoView {
    let mut db = use_context::<DBStore>().unwrap();
    let tables = create_resource(
        || {},
        move |_| {
            let schema = schema.clone();
            async move { db.get_tables(schema).await.unwrap() }
        },
    );

    view! {
        <Suspense fallback=|| view! { <p class="pl-2">Loading...</p> }>
            <Show when=move || !tables.get().unwrap_or_default().is_empty() fallback=|| view! { <p class="pl-2">No tables found</p> }>
                {move || tables.get().unwrap_or_default().into_iter().enumerate().map(|(i, t)| view! {
                    <li key=i class="pl-4">{t}</li>
                }).collect_view()}
            </Show>
        </Suspense>
    }
}
