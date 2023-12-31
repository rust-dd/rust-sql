use leptos::{html::*, *};
use leptos_icons::*;

use crate::store::{projects::ProjectsStore, query::QueryStore};

pub fn component(table: (String, String), project_name: String, schema: String) -> impl IntoView {
  let query_store = use_context::<QueryStore>().unwrap();
  //   let query = create_action(move || {
  //     let project_name = project_name.clone();
  //     let schema = schema.clone();
  //     let table = table.clone();
  //     async move {
  //       query_store
  //         .run_query(&project_name, &schema, &table.0)
  //         .await
  //         .unwrap()
  //     }
  //   });
  //   spawn_local(async move {
  //     let editor_state = use_context::<EditorState>().unwrap();
  //     editor_state.set_value(&format!("SELECT * FROM {}.{} LIMIT 100;", schema, t_clone));
  //     query_state.run_query().await;
  //               });

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
        .child(p().child(table.0)),
    )
    .child(p().child(table.1))
}
