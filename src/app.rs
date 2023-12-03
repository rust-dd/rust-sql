use crate::{
    layout::Layout,
    query_editor::{ModelCell, QueryEditor},
    store::db::DBStore,
};
use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    provide_context(DBStore::default());
    let (editor, set_editor) = create_signal(ModelCell::default());

    view! {
        <Layout>
            <QueryEditor set_editor=set_editor/>
        </Layout>
    }
}

