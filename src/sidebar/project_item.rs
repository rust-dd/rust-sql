use leptos::{html::*, *};

use super::schema_list;

pub fn component(project_name: String) -> impl IntoView {
  let (show_schemas, set_show_schemas) = create_signal(false);

  div()
    .classes("pl-1 text-xs")
    .child(
      div()
        .classes("flex flex-row justify-between items-center")
        .child(
          button()
            .classes("hover:font-semibold")
            .child(&project_name)
            .on(ev::click, move |_| set_show_schemas(!show_schemas())),
        )
        .child(
          button()
            .classes("px-2 rounded-full hover:bg-gray-200")
            .child("-")
            .on(ev::click, {
              move |_| {
                // delete_project.dispatch((db_state, project.clone()));
              }
            }),
        ),
    )
    .child(div().classes("pl-1").child(Suspense(SuspenseProps {
      fallback: ViewFn::from(|| "Loading..."),
      children: ChildrenFn::to_children(move || {
        let project_name = project_name.clone();
        Fragment::new(vec![Show(ShowProps {
          children: (move || {
            let project_name = project_name.clone();
            ChildrenFn::to_children(move || {
              let project_name = project_name.clone();
              Fragment::new(vec![
                schema_list::component(project_name.clone()).into_view()
              ])
            })
          })(),
          when: move || show_schemas(),
          fallback: ViewFn::from(div),
        })
        .into_view()])
      }),
    })))
}
