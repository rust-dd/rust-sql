use crate::store::query::QueryStore;
use leptos::{html::*, *};
use leptos_icons::*;

pub fn queries() -> impl IntoView {
  let query_state = use_context::<QueryStore>().unwrap();
  create_resource(
    || {},
    move |_| async move {
      query_state.select_queries().await.unwrap();
    },
  );

  move || {
    query_state
      .saved_queries
      .get()
      .into_iter()
      .enumerate()
      .map(|(idx, (key, _))| {
        div()
          .prop("key", idx)
          .classes("flex flex-row justify-between items-center")
          .child(
            button()
              .classes("hover:font-semibold")
              .child(
                div()
                  .classes("flex flex-row items-center gap-1")
                  .child(Icon(IconProps {
                    icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiCircleStackOutlineLg)),
                    width: Some(MaybeSignal::derive(|| String::from("12"))),
                    height: Some(MaybeSignal::derive(|| String::from("12"))),
                    class: None,
                    style: None,
                  }))
                  .child(&key),
              )
              .on(ev::click, {
                let key = key.clone();
                move |_| {
                  query_state.load_query(&key).unwrap();
                }
              }),
          )
          .child(
            button()
              .classes("px-2 rounded-full hover:bg-gray-200")
              .child("-")
              .on(ev::click, move |_| {
                let key = key.clone();
                spawn_local(async move {
                  query_state.delete_query(&key).await.unwrap();
                })
              }),
          )
      })
      .collect_view()
  }
}
