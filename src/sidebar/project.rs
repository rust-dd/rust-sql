use leptos::{html::*, *};

use crate::store::{active_project::ActiveProjectStore, projects::ProjectsStore};

use super::schemas;

pub fn component(project: String) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let active_project_store = use_context::<ActiveProjectStore>().unwrap();
  let (show_schemas, set_show_schemas) = create_signal(false);
  let delete_project = create_action(move |(projects_store, project): &(ProjectsStore, String)| {
    let projects_store = *projects_store;
    let project = project.clone();
    async move {
      projects_store.delete_project(&project).await.unwrap();
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
            .child(&project)
            .on(ev::click, {
              let project = project.clone();
              move |_| {
                active_project_store.0.set(Some(project.clone()));
                set_show_schemas(!show_schemas());
              }
            }),
        )
        .child(
          button()
            .classes("px-2 rounded-full hover:bg-gray-200")
            .child("-")
            .on(ev::click, {
              let project = project.clone();
              move |_| {
                delete_project.dispatch((projects_store, project.clone()));
              }
            }),
        ),
    )
    .child(div().classes("pl-1").child(Suspense(SuspenseProps {
      fallback: ViewFn::from(|| "Loading..."),
      children: ChildrenFn::to_children(move || {
        let project = project.clone();
        Fragment::new(vec![Show(ShowProps {
          children: {
            let project = project.clone();
            ChildrenFn::to_children(move || {
              let project = project.clone();
              Fragment::new(vec![schemas::component(project.clone()).into_view()])
            })
          },
          when: show_schemas,
          fallback: ViewFn::default(),
        })
        .into_view()])
      }),
    })))
}
