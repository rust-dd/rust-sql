use crate::{
    layout::Layout,
    query_editor::QueryEditor,
    store::{db::DBStore, editor::EditorState},
};
use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    provide_context(DBStore::default());
    provide_context(EditorState::default());

    view! {
        <Layout>
            <QueryEditor/>
        </Layout>
    }
}

