use leptos::*;

use super::schema;
use crate::store::projects::ProjectsStore;

pub fn component(project_name: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let project_name_clone = project_name.clone();
  let schemas = create_resource(
    || {},
    move |_| {
      let project_name = project_name.clone();
      async move { projects_store.connect(&project_name).await.unwrap() }
    },
  );

  For(ForProps {
    each: move || schemas.get().unwrap_or_default(),
    key: |schema| schema.clone(),
    children: move |s| {
      let project_name = project_name_clone.clone();
      schema::component(s, project_name)
    },
  })
}
