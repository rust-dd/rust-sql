use leptos::*;

use super::schema::Schema;
use crate::store::projects::ProjectsStore;

#[component]
pub fn Schemas(project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let project_clone = project.clone();
  let schemas = create_resource(
    || {},
    move |_| {
      let project = project.clone();
      async move { projects_store.connect(&project).await.unwrap() }
    },
  );

  view! {
      <For
          each=move || schemas.get().unwrap_or_default()
          key=|schema| schema.clone()
          children=move |s| {
              let project = project_clone.clone();
              view! { <Schema schema=s project=project.clone()/> }
          }
      />
  }
}

