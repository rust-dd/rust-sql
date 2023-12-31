use leptos::{html::*, *};

use super::table;
use crate::store::projects::ProjectsStore;

pub fn component(schema: String, project_name: String) -> impl IntoView {
  let project_store = use_context::<ProjectsStore>().unwrap();
  let schema_clone = schema.clone();
  let project_name_clone = project_name.clone();
  let tables = create_resource(
    || {},
    move |_| {
      let schema = schema_clone.clone();
      let project_name = project_name_clone.clone();
      async move {
        project_store
          .retrieve_tables(&project_name, &schema)
          .await
          .unwrap()
      }
    },
  );

  div().child(For(ForProps {
    each: move || tables.get().unwrap_or_default(),
    key: |table| table.0.clone(),
    children: move |t| table::component(t, project_name.clone(), schema.clone()),
  }))
}
