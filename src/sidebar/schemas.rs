use leptos::*;

use super::schema;
use crate::store::projects::ProjectsStore;

pub fn component(project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let project_clone = project.clone();
  let schemas = create_resource(
    || {},
    move |_| {
      let project = project.clone();
      async move { projects_store.connect(&project).await.unwrap() }
    },
  );

  For(ForProps {
    each: move || schemas.get().unwrap_or_default(),
    key: |schema| schema.clone(),
    children: move |s| {
      let project = project_clone.clone();
      schema::component(s, project)
    },
  })
}
