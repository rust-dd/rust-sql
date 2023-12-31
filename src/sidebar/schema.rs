use leptos::{html::*, *};

use super::tables;

pub fn component(schema: String, project_name: String) -> impl IntoView {
  let (show_tables, set_show_tables) = create_signal(false);

  div()
    .child(
      button()
        .classes("hover:font-semibold cursor-pointer")
        .child(&schema)
        .on(ev::click, move |_| set_show_tables(!show_tables())),
    )
    .child(div().classes("pl-1").child(Suspense(SuspenseProps {
      fallback: ViewFn::from(|| "Loading..."),
      children: ChildrenFn::to_children(move || {
        let schema = schema.clone();
        let project_name = project_name.clone();
        Fragment::new(vec![Show(ShowProps {
          children: {
            let schema = schema.clone();
            let project_name = project_name.clone();
            ChildrenFn::to_children(move || {
              let schema = schema.clone();
              let project_name = project_name.clone();
              Fragment::new(vec![tables::component(schema, project_name).into_view()])
            })
          },
          when: show_tables,
          fallback: ViewFn::from(div),
        })
        .into_view()])
      }),
    })))
}
