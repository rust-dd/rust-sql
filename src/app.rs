use crate::{
    layout::Layout,
    query_editor::QueryEditor,
    query_table::QueryTable,
    store::{db::DBStore, editor::EditorState, query::QueryState},
};
use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    provide_context(DBStore::default());
    provide_context(EditorState::default());
    provide_context(QueryState::default());

    view! {
        <Layout>
            <QueryEditor/>
            <QueryTable/>
        </Layout>
    }
}

