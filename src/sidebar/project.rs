use leptos::{html::*, *};

use crate::store::projects::ProjectsStore;

use super::schemas;

pub fn component(project_name: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let (show_schemas, set_show_schemas) = create_signal(false);
  let delete_project = create_action(move |(project_store, project): &(ProjectsStore, String)| {
    let project_store = project_store.clone();
    let project = project.clone();
    async move {
      project_store.delete_project(&project).await.unwrap();
    }
  });

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
              let project_name = project_name.clone();
              move |_| {
                delete_project.dispatch((projects_store, project_name.clone()));
              }
            }),
        ),
    )
    .child(div().classes("pl-1").child(Suspense(SuspenseProps {
      fallback: ViewFn::from(|| "Loading..."),
      children: ChildrenFn::to_children(move || {
        let project_name = project_name.clone();
        Fragment::new(vec![Show(ShowProps {
          children: {
            let project_name = project_name.clone();
            ChildrenFn::to_children(move || {
              let project_name = project_name.clone();
              Fragment::new(vec![schemas::component(project_name.clone()).into_view()])
            })
          },
          when: show_schemas,
          fallback: ViewFn::from(div),
        })
        .into_view()])
      }),
    })))
}
