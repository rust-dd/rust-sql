use crate::store::query::QueryStore;
use leptos::*;

use super::query;

pub fn component() -> impl IntoView {
  let query_state = use_context::<QueryStore>().unwrap();
  let queries = create_resource(
    move || query_state.saved_queries.get(),
    move |_| async move { query_state.select_queries().await.unwrap() },
  );

  For(ForProps {
    each: move || queries.get().unwrap_or_default(),
    key: |(key, _)| key.clone(),
    children: move |(key, _)| query::component(key),
  })
}
