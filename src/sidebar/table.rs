use std::sync::{Arc, Mutex};

use leptos::{html::*, *};
use leptos_icons::*;

use crate::store::{active_project::ActiveProjectStore, tabs::TabsStore};

pub fn component(table: (String, String), project: String, schema: String) -> impl IntoView {
  let tabs_store = Arc::new(Mutex::new(use_context::<TabsStore>().unwrap()));
  let active_project = use_context::<ActiveProjectStore>().unwrap();
  let query = create_action(
    move |(schema, table, tabs_store): &(String, String, Arc<Mutex<TabsStore>>)| {
      let project = project.clone();
      let schema = schema.clone();
      let table = table.clone();
      active_project.0.set(Some(project.clone()));
      tabs_store
        .lock()
        .unwrap()
        .set_editor_value(&format!("SELECT * FROM {}.{} LIMIT 100;", schema, table));
      let tabs_store = tabs_store.clone();
      async move { tabs_store.lock().unwrap().run_query().await.unwrap() }
    },
  );

  div()
    .classes("flex flex-row justify-between items-center hover:font-semibold cursor-pointer")
    .child(
      div()
        .classes("flex flex-row items-center gap-1")
        .child(Icon(IconProps {
          icon: MaybeSignal::Static(icondata::HiTableCellsOutlineLg),
          width: MaybeProp::from(String::from("12")),
          height: MaybeProp::from(String::from("12")),
          class: MaybeProp::default(),
          style: MaybeProp::default(),
        }))
        .child(p().child(table.clone().0)),
    )
    .child(p().child(table.clone().1))
    .on(ev::click, {
      let table = table.clone();
      move |_| query.dispatch((schema.clone(), table.0.clone(), tabs_store.clone()))
    })
}
