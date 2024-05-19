use crate::store::queries::QueriesStore;
use leptos::*;

use super::query::Query;

#[component]
pub fn Queries() -> impl IntoView {
  let queries_store = expect_context::<QueriesStore>();
  let _ = create_resource(
    move || queries_store.0.get(),
    move |_| async move {
      queries_store.load_queries().await;
    },
  );

  view! {
      <For
          each=move || queries_store.0.get()
          key=|(key, _)| key.clone()
          children=move |(key, _)| view! { <Query key=key/> }
      />
  }
}

