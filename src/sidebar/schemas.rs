use leptos::*;

use super::schema::Schema;

#[component]
pub fn Schemas(schemas: Vec<String>) -> impl IntoView {
  view! {
      <For
          each=move || schemas.clone()
          key=|schema| schema.clone()
          children=move |schema| {
              view! { <Schema schema=schema/> }
          }
      />
  }
}

