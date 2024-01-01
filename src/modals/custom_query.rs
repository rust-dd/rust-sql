use leptos::{html::*, *};
use thaw::{Modal, ModalFooter, ModalProps};

use crate::store::{projects::ProjectsStore, query::QueryStore};

pub fn component(show: RwSignal<bool>) -> impl IntoView {
  let projects_store = use_context::<ProjectsStore>().unwrap();
  let query_store = use_context::<QueryStore>().unwrap();
  let (query_title, set_query_title) = create_signal(String::new());
  let projects = create_memo(move |_| projects_store.get_projects().unwrap());
  let (project, set_project) = create_signal(String::new());
  let insert_query = create_action(
    move |(query_db, key, project): &(QueryStore, String, String)| {
      let query_db_clone = *query_db;
      let key = key.clone();
      let project = project.clone();
      async move {
        query_db_clone.insert_query(&key, &project).await.unwrap();
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
            .child(For(ForProps {
              each: move || projects.get(),
              key: |project| project.clone(),
              children: move |p| {
                option()
                  .prop("value", &p)
                  .prop("selected", p == project())
                  .child(&p)
              },
            }))
            .on(ev::change, move |e| {
              set_project(event_target_value(&e));
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
                insert_query.dispatch((query_store, query_title(), project()));
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
