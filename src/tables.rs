use crate::store::{db::DBStore, editor::EditorState, query::QueryState};
use leptos::{html::*, *};

pub fn tables(schema: String) -> impl IntoView {
  let db = use_context::<DBStore>().unwrap();
  let query_state = use_context::<QueryState>().unwrap();
  let tables = create_resource(
    || {},
    move |_| {
      let schema = schema.clone();
      async move { db.select_tables(schema).await.unwrap() }
    },
  );
  let when = move || !tables.get().unwrap_or_default().is_empty();
  let show_fallback = move || ViewFn::from(|| p().classes("pl-2").child("No tables found"));
  let fallback = ViewFn::from(|| p().classes("pl-2").child("Loading..."));
  let tables = move || {
    tables
      .get()
      .unwrap_or_default()
      .into_iter()
      .enumerate()
      .map(|(i, (table, size, is_selected))| {
        let table_clone = table.clone();
        li()
          .prop("key", i)
          .classes(if is_selected {
            "pl-2 font-semibold cursor-pointer"
          } else {
            "hover:font-semibold pl-2 cursor-pointer"
          })
          .on(ev::click, move |_| {
            let schema = db
              .schemas
              .get_untracked()
              .iter()
              .find(|(_, is_selected)| **is_selected)
              .unwrap()
              .0
              .clone();
            let t_clone = table_clone.clone();
            spawn_local(async move {
              let editor_state = use_context::<EditorState>().unwrap();
              editor_state.set_value(&format!("SELECT * FROM {}.{} LIMIT 100;", schema, t_clone));
              query_state.run_query().await;
            });
            let table_clone = table_clone.clone();
            tables.update(move |prev| {
              prev.iter_mut().for_each(|tables| {
                tables.iter_mut().for_each(|(t, _, s)| {
                  *s = t == &table_clone;
                });
              });
            });
          })
          .child(
            div()
              .classes("flex flex-row justify-between items-center")
              .child(p().classes("pl-2 text-xs").child(table))
              .child(p().classes("text-xs").child(size)),
          )
      })
      .collect_view()
  };
  let show_children =
    move || ChildrenFn::to_children(move || Fragment::new(vec![tables().into_view()]));
  let children = ChildrenFn::to_children(move || {
    Fragment::new(vec![Show(ShowProps {
      children: show_children(),
      when,
      fallback: show_fallback(),
    })
    .into_view()])
  });
  Suspense::<Fragment>(SuspenseProps { fallback, children })
}
