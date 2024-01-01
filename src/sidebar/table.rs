use leptos::{html::*, *};
use leptos_icons::*;

use crate::store::{active_project::ActiveProjectStore, editor::EditorStore, query::QueryStore};

pub fn component(table: (String, String), project: String, schema: String) -> impl IntoView {
  let query_store = use_context::<QueryStore>().unwrap();
  let editor_store = use_context::<EditorStore>().unwrap();
  let active_project = use_context::<ActiveProjectStore>().unwrap();
  let query = create_action(move |(schema, table): &(String, String)| {
    let project = project.clone();
    let schema = schema.clone();
    let table = table.clone();
    active_project.0.set(Some(project.clone()));
    editor_store.set_value(&format!("SELECT * FROM {}.{} LIMIT 100;", schema, table));
    async move { query_store.run_query().await.unwrap() }
  });

  div()
    .classes("flex flex-row justify-between items-center hover:font-semibold cursor-pointer")
    .child(
      div()
        .classes("flex flex-row items-center gap-1")
        .child(Icon(IconProps {
          icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiTableCellsOutlineLg)),
          width: Some(MaybeSignal::derive(|| String::from("12"))),
          height: Some(MaybeSignal::derive(|| String::from("12"))),
          class: None,
          style: None,
        }))
        .child(p().child(table.clone().0)),
    )
    .child(p().child(table.clone().1))
    .on(ev::click, {
      let table = table.clone();
      move |_| query.dispatch((schema.clone(), table.0.clone()))
    })
}
