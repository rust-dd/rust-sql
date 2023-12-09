use crate::{
  invoke::{Invoke, InvokeProjectsArgs},
  store::db::DBStore,
  tables::tables,
  wasm_functions::invoke,
};
use leptos::{html::*, *};

pub fn sidebar() -> impl IntoView {
  let mut db = use_context::<DBStore>().unwrap();
  let get_project_details = create_action(move |(db, project): &(DBStore, String)| {
    let mut db_clone = *db;
    let project = project.clone();
    async move { db_clone.get_project_details(project).await }
  });
  let projects = create_resource(
    move || db.is_connecting.get(),
    move |_| async move {
      let projects = invoke(
        &Invoke::get_projects.to_string(),
        serde_wasm_bindgen::to_value(&InvokeProjectsArgs).unwrap_or_default(),
      )
      .await;
      serde_wasm_bindgen::from_value::<Vec<String>>(projects).unwrap()
    },
  );
  let remove_project = create_action(move |(db, project): &(DBStore, String)| {
    let mut db_clone = *db;
    let project = project.clone();
    async move {
      db_clone.remove_project(project).await.unwrap();
      projects.refetch();
    }
  });
  let projects_result = move || {
    projects
      .get()
      .unwrap_or_default()
      .into_iter()
      .enumerate()
      .map(|(idx, project)| {
        div()
          .attr("key", idx)
          .attr("class", "flex flex-row justify-between items-center")
          .child(
            button()
              .attr("class", "hover:font-semibold")
              .child(&project)
              .on(ev::click, {
                let project = project.clone();
                move |_| get_project_details.dispatch((db, project.clone()))
              }),
          )
          .child(
            button()
              .attr("class", "px-2 rounded-full hover:bg-gray-200")
              .child("-")
              .on(ev::click, {
                let project = project.clone();
                move |_| {
                  remove_project.dispatch((db, project.clone()));
                }
              }),
          )
      })
      .collect_view()
  };

  div()
    .attr(
      "class",
      "flex border-r-1 min-w-[200px] border-neutral-200 flex-col gap-2 px-4 pt-4 overflow-auto",
    )
    .child(
      div()
        .attr("class", "flex w-full flex-row justify-between items-center")
        .child(p().attr("class", "font-semibold").child("Projects"))
        .child(
          button()
            .attr("class", "px-2 rounded-full hover:bg-gray-200")
            .child("+")
            .on(ev::click, move |_| db.reset()),
        ),
    )
    .child(Suspense(SuspenseProps {
      children: ChildrenFn::to_children(move || Fragment::new(vec![projects_result.into_view()])),
      fallback: ViewFn::from(|| p().child("Loading...")),
    }))
    .child(p().attr("class", "font-semibold").child("Schemas"))
    .child(Show(ShowProps {
      when: move || db.is_connecting.get(),
      children: ChildrenFn::to_children(move || {
        Fragment::new(vec![p().child("Loading...").into_view()])
      }),
      fallback: ViewFn::from(div),
    }))
    .child(move || {
      db.schemas
        .get()
        .into_iter()
        .map(|(schema, toggle)| {
          let s = schema.clone();
          div()
            .attr("key", &schema)
            .child(
              button()
                .attr(
                  "class",
                  if toggle {
                    "font-semibold"
                  } else {
                    "hover:font-semibold"
                  },
                )
                .on(ev::click, move |_| {
                  let s_clone = s.clone();
                  db.schemas.update(move |prev| {
                    prev.insert(s_clone, !toggle);
                  });
                })
                .child(&schema),
            )
            .child(Show(ShowProps {
              when: move || toggle,
              children: ChildrenFn::to_children(move || {
                Fragment::new(vec![tables(schema.clone()).into_view()])
              }),
              fallback: ViewFn::from(div),
            }))
        })
        .collect_view()
    })
}

