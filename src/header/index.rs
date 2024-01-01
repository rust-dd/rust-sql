use leptos::{html::*, *};
use leptos_use::{use_document, use_event_listener};

use crate::{modals, store::query::QueryStore};

pub fn component() -> impl IntoView {
  let show = create_rw_signal(false);
  let _ = use_event_listener(use_document(), ev::keydown, move |event| {
    if event.key() == "Escape" {
      show.set(false);
    }
  });
  let query_store = use_context::<QueryStore>().unwrap();
  let run_query = create_action(move |query_store: &QueryStore| {
    let query_store = *query_store;
    async move { query_store.run_query().await }
  });

  header()
    .classes("flex flex-row justify-between p-4 gap-2 border-b-1 border-neutral-200")
    .child(div().child(modals::custom_query::component(show)))
    .child(
      div()
        .classes("flex flex-row gap-2")
        .child(
          button()
            .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
            .on(ev::click, move |_| show.set(true))
            .child("Save Query"),
        )
        .child(
          button()
            .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
            .on(ev::click, move |_| run_query.dispatch(query_store))
            .child("Query"),
        ),
    )
}
