use crate::store::queries::QueriesStore;
use leptos::*;

use super::query::Query;

#[component]
pub fn Queries() -> impl IntoView {
  let queries_store = expect_context::<QueriesStore>();
  let _ = create_resource(
    move || queries_store.get(),
    move |_| async move {
      queries_store.load_queries().await;
    },
  );

  view! {
      <For
          each=move || queries_store.get()
          key=|(query_id, _)| query_id.clone()
          children=move |(query_id, sql)| view! { <Query query_id sql/> }
      />
  }
}

