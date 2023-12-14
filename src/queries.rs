use leptos::{html::*, *};

use crate::{
  invoke::{Invoke, InvokeSelectQueriesArgs},
  store::query::QueryState,
  wasm_functions::invoke,
};

pub fn queries() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();
  let queries = move || query_state.saved_queries.get();
  let q = create_resource(
    || {},
    move |_| async move { query_state.select_queries().await.unwrap() },
  );
  logging::log!("queries, {:?}", q);

  let queries_result = move || {
    queries()
      .into_iter()
      .enumerate()
      .map(|(idx, (name, sql))| {
        div()
          .prop("key", idx)
          .classes("flex flex-row justify-between items-center")
          .child(
            button()
              .classes("hover:font-semibold")
              .child(&name)
              .on(ev::click, {
                let sql = sql.clone();
                move |_| {
                  query_state.sql.update(|prev| {
                    *prev = sql.clone();
                  });
                }
              }),
          )
          .child(
            button()
              .classes("hover:font-semibold")
              .child("Delete")
              .on(ev::click, {
                let name = name.clone();
                move |_| {
                  query_state.delete_query(&name);
                }
              }),
          )
      })
      .collect_view()
  };
  let children =
    move || ChildrenFn::to_children(move || Fragment::new(vec![queries_result().into_view()]));
  let fallback = ViewFn::from(|| p().classes("pl-2").child("Loading..."));
  Suspense::<Fragment>(SuspenseProps {
    fallback,
    children: children(),
  })
}
