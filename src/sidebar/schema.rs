use leptos::{html::*, *};

use super::tables;

pub fn component(schema: String, project: String) -> impl IntoView {
  let (show_tables, set_show_tables) = create_signal(false);

  div()
    .child(
      div()
        .classes("hover:font-semibold cursor-pointer sticky top-0 z-10 bg-white")
        .child(&schema)
        .on(ev::click, move |_| set_show_tables(!show_tables())),
    )
    .child(div().classes("pl-1").child(Suspense(SuspenseProps {
      fallback: ViewFn::from(|| "Loading..."),
      children: ChildrenFn::to_children(move || {
        let schema = schema.clone();
        let project = project.clone();
        Fragment::new(vec![Show(ShowProps {
          children: {
            let schema = schema.clone();
            let project = project.clone();
            ChildrenFn::to_children(move || {
              let schema = schema.clone();
              let project = project.clone();
              Fragment::new(vec![tables::component(schema, project).into_view()])
            })
          },
          when: show_tables,
          fallback: ViewFn::default(),
        })
        .into_view()])
      }),
    })))
}
