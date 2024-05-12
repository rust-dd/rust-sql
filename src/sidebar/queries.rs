use crate::store::query::QueryStore;
use leptos::*;

use super::query::Query;

#[component]
pub fn Queries() -> impl IntoView {
  let query_state = expect_context::<QueryStore>();
  let queries = create_resource(
    move || query_state.0.get(),
    move |_| async move { query_state.select_queries().await.unwrap() },
  );

  view! {
      <For
          each=move || queries.get().unwrap_or_default()
          key=|(key, _)| key.clone()
          children=move |(key, _)| view! { <Query key=key/> }
      />
  }
}

