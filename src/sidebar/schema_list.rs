use leptos::{html::*, *};

use crate::store::projects::ProjectsStore;

pub fn component(project_name: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
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
    children: move |schema| {
      div()
        .child(
          p()
            .classes("hover:font-semibold cursor-pointer")
            .child(schema),
        )
        .child(div().classes("pl-1").child("tables"))
    },
  })
}
