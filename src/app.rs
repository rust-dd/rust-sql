use crate::{layout::Layout, store::db::DBStore};
use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    provide_context(DBStore::default());

    view! {
        <Layout>
            <div>Ide jön a táblázat</div>
        </Layout>
    }
}
