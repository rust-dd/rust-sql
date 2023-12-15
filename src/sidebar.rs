use crate::{
  invoke::{Invoke, InvokeProjectsArgs},
  queries::queries,
  store::db::DBStore,
  tables::tables,
  wasm_functions::invoke,
};
use leptos::{html::*, *};

pub fn sidebar() -> impl IntoView {
  let db_state = use_context::<DBStore>().unwrap();
  let select_project_details = create_action(move |(db, project): &(DBStore, String)| {
    let db_clone = *db;
    let project = project.clone();
    async move { db_clone.select_project_details(project).await }
  });
  let projects = create_resource(
    move || db_state.is_connecting.get(),
    move |_| async move {
      let projects = invoke(
        &Invoke::select_projects.to_string(),
        serde_wasm_bindgen::to_value(&InvokeProjectsArgs).unwrap_or_default(),
      )
      .await;
      serde_wasm_bindgen::from_value::<Vec<String>>(projects).unwrap()
    },
  );
  let delete_project = create_action(move |(db, project): &(DBStore, String)| {
    let mut db_clone = *db;
    let project = project.clone();
    async move { db_clone.delete_project(project).await }
  });
  let projects_result = move || {
    projects
      .get()
      .unwrap_or_default()
      .into_iter()
      .enumerate()
      .map(|(idx, project)| {
        div()
          .prop("key", idx)
          .classes("flex flex-row justify-between items-center pl-1")
          .child(
            button()
              .classes("hover:font-semibold text-sm")
              .child(&project)
              .on(ev::click, {
                let project = project.clone();
                move |_| select_project_details.dispatch((db_state, project.clone()))
              }),
          )
          .child(
            button()
              .classes("px-2 rounded-full hover:bg-gray-200")
              .child("-")
              .on(ev::click, {
                let project = project.clone();
                move |_| {
                  delete_project.dispatch((db_state, project.clone()));
                }
              }),
          )
      })
      .collect_view()
  };

  div()
    .classes("flex border-r-1 min-w-[320px] justify-between border-neutral-200 flex-col p-4")
    .child(
      div()
        .classes("flex flex-col overflow-auto")
        .child(
          div()
            .child(
              div()
                .classes("flex flex-row justify-between items-center")
                .child(p().classes("font-semibold text-lg").child("Projects"))
                .child(
                  button()
                    .classes("px-2 rounded-full hover:bg-gray-200")
                    .child("+")
                    .on(ev::click, move |_| db_state.reset()),
                ),
            )
            .child(projects_result.into_view()),
        )
        .child(
          div()
            .classes("flex flex-col overflow-y-auto h-[calc(100vh-200px)] mt-4")
            .child(
              div().classes("font-semibold sticky top-0 bg-white").child(
                div()
                  .classes("flex flex-row justify-between gap-2 items-center font-semibold text-lg")
                  .child("Connected to: ")
                  .child(move || db_state.project.get()),
              ),
            )
            .child(Show(ShowProps {
              when: move || db_state.is_connecting.get(),
              children: ChildrenFn::to_children(move || {
                Fragment::new(vec![p().child("Loading...").into_view()])
              }),
              fallback: ViewFn::from(div),
            }))
            .child(move || {
              db_state
                .schemas
                .get()
                .into_iter()
                .map(|(schema, toggle)| {
                  let s = schema.clone();
                  div()
                    .classes("pl-1 text-xs")
                    .prop("key", &schema)
                    .child(
                      button()
                        .classes(if toggle {
                          "font-semibold"
                        } else {
                          "hover:font-semibold"
                        })
                        .classes("text-sm")
                        .on(ev::click, move |_| {
                          let s_clone = s.clone();
                          db_state.schemas.update(move |prev| {
                            prev.insert(s_clone, !toggle);
                          });
                        })
                        .child(&schema),
                    )
                    .child(div().classes("pl-1").child(Show(ShowProps {
                      when: move || toggle,
                      children: ChildrenFn::to_children(move || {
                        Fragment::new(vec![tables(schema.clone()).into_view()])
                      }),
                      fallback: ViewFn::from(div),
                    })))
                })
                .collect_view()
            }),
        ),
    )
    .child(
      div()
        .classes("py-2")
        .child(p().classes("font-semibold text-lg").child("Saved Queries"))
        .child(div().classes("text-sm").child(queries().into_view())),
    )
}
