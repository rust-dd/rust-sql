use common::project::ProjectDetails;
use leptos::{html::*, IntoView, *};

use crate::{
  invoke::{Invoke, InvokeProjectsArgs},
  queries::queries,
  store::projects::{Project, ProjectsStore},
  wasm_functions::invoke,
};

pub fn sidebar() -> impl IntoView {
  let projects_state = use_context::<ProjectsStore>().unwrap();
  create_resource(
    || {},
    move |_| async move {
      let args = serde_wasm_bindgen::to_value(&InvokeProjectsArgs).unwrap_or_default();
      let projects = invoke(&Invoke::select_projects.to_string(), args).await;
      let projects = serde_wasm_bindgen::from_value::<Vec<ProjectDetails>>(projects).unwrap();
      projects_state.set_projects(projects).unwrap();
    },
  );

  div()
    .classes("flex border-r-1 min-w-[320px] justify-between border-neutral-200 flex-col p-4")
    .child(
      div().classes("flex flex-col overflow-auto").child(
        div()
          .child(
            div()
              .classes("flex flex-row justify-between items-center")
              .child(p().classes("font-semibold text-lg").child("Projects"))
              .child(
                button()
                  .classes("px-2 rounded-full hover:bg-gray-200")
                  .child("+")
                  .on(ev::click, move |_| {}),
              ),
          )
          .child(For(ForProps {
            each: move || projects_state.0.get(),
            key: |(project, _)| project.clone(),
            children: |(project, _)| {
              div()
                .classes("flex flex-row justify-between items-center pl-1")
                .child(
                  button()
                    .classes("hover:font-semibold text-sm")
                    .child(&project)
                    .on(ev::click, {
                      let project = project.clone();
                      move |_| () //select_project_details.dispatch((db_state, project.clone()))
                    }),
                )
                .child(
                  button()
                    .classes("px-2 rounded-full hover:bg-gray-200")
                    .child("-")
                    .on(ev::click, {
                      let project = project.clone();
                      move |_| {
                        // delete_project.dispatch((db_state, project.clone()));
                      }
                    }),
                )
            },
          })),
      ),
    )
    .child(
      div()
        .classes("py-2")
        .child(p().classes("font-semibold text-lg").child("Saved Queries"))
        .child(div().classes("text-sm").child(queries().into_view())),
    )
}
