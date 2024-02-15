use leptos::{html::*, *};
use thaw::{Modal, ModalFooter, ModalProps};

use crate::store::{
  active_project::ActiveProjectStore, projects::ProjectsStore, query::QueryStore,
};

pub fn component(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let query_store = use_context::<QueryStore>().unwrap();
  let (query_title, set_query_title) = create_signal(String::new());
  let projects = create_memo(move |_| projects_store.get_projects().unwrap());
  let active_project = use_context::<ActiveProjectStore>().unwrap();
  let (project_name, set_project_name) = create_signal(active_project.0.get().unwrap_or_default());
  create_effect(move |_| {
    if !projects.get().is_empty() {
      set_project_name(projects.get()[0].clone());
    }
  });

  let insert_query = create_action(
    move |(query_db, key, project_name): &(QueryStore, String, String)| {
      let query_db_clone = *query_db;
      let key = key.clone();
      let project_name = project_name.clone();
      async move {
        query_db_clone
          .insert_query(&key, &project_name)
          .await
          .unwrap();
      }
    },
  );

  Modal(ModalProps {
    show,
    title: MaybeSignal::Static(String::from("Save query!")),
    children: Children::to_children(move || {
      Fragment::new(vec![div()
        .classes("flex flex-col gap-2")
        .child(
          select()
            .classes("border-1 border-neutral-200 p-1 rounded-md w-full bg-white appearance-none")
            .prop("value", project_name)
            .prop("default_value", "teszt")
            .prop("placeholder", "Select project..")
            .child(For(ForProps {
              each: move || projects.get(),
              key: |project| project.clone(),
              children: move |p| {
                option()
                  .prop("value", &p)
                  .prop("selected", project_name() == p)
                  .child(&p)
              },
            }))
            .on(ev::change, move |e| {
              set_project_name(event_target_value(&e));
            }),
        )
        .child(
          input()
            .classes("border-1 border-neutral-200 p-1 rounded-md w-full")
            .prop("type", "text")
            .prop("placeholder", "Add query name..")
            .prop("value", query_title)
            .on(ev::input, move |e| {
              set_query_title(event_target_value(&e));
            }),
        )
        .into_view()])
    }),
    modal_footer: Some(ModalFooter {
      children: ChildrenFn::to_children(move || {
        Fragment::new(vec![div()
          .classes("flex gap-2 justify-end")
          .child(
            button()
              .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
              .on(ev::click, move |_| {
                insert_query.dispatch((query_store, query_title(), project_name()));
                show.set(false);
              })
              .child("Save"),
          )
          .child(
            button()
              .classes("px-4 py-2 border-1 border-neutral-200 hover:bg-neutral-200 rounded-md")
              .on(ev::click, move |_| show.set(false))
              .child("Cancel"),
          )
          .into_view()])
      }),
    }),
  })
}

