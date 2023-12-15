use crate::store::{db::DBStore, editor::EditorState, query::QueryState};
use leptos::{html::*, *};
use leptos_icons::*;

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
  let show_fallback = move || ViewFn::from(|| "No tables found");
  let fallback = ViewFn::from(|| "Loading...");
  let tables = move || {
    div().child(
      tables
        .get()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(i, (table, size, is_selected))| {
          let table_clone = table.clone();
          div()
            .prop("key", i)
            .classes(if is_selected {
              "font-semibold cursor-pointer"
            } else {
              "hover:font-semibold cursor-pointer"
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
                .child(
                  div()
                    .classes("flex flex-row items-center gap-1")
                    .child(Icon(IconProps {
                      icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiTableCellsOutlineLg)),
                      width: Some(MaybeSignal::derive(|| 12.to_string())),
                      height: Some(MaybeSignal::derive(|| 12.to_string())),
                      class: None,
                      style: None,
                    }))
                    .child(p().child(table)),
                )
                .child(p().child(size)),
            )
        })
        .collect_view(),
    )
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
