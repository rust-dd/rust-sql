use leptos::*;

use super::table::Table;
use crate::store::projects::ProjectsStore;

#[component]
pub fn Tables(schema: String, project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let schema_clone = schema.clone();
  let project_clone = project.clone();
  let tables = create_resource(
    || {},
    move |_| {
      let schema = schema_clone.clone();
      let project = project_clone.clone();
      async move {
        projects_store
          .retrieve_tables(&project, &schema)
          .await
          .unwrap()
      }
    },
  );

  view! {
      <For
          each=move || tables.get().unwrap_or_default()
          key=|table| table.0.clone()
          children=move |t| view! { <Table table=t schema=schema.clone() project=project.clone()/> }
      />
  }
}

