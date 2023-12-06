use std::vec;

use crate::{
    layout::layout,
    query_editor::query_editor,
    query_table::query_table,
    store::{db::DBStore, editor::EditorState, query::QueryState},
};
use leptos::*;

pub fn app() -> impl IntoView {
    provide_context(DBStore::default());
    provide_context(EditorState::default());
    provide_context(QueryState::default());

    layout(Children::to_children(move || {
        Fragment::new(vec![query_editor().into_view(), query_table().into_view()])
    }))
}

