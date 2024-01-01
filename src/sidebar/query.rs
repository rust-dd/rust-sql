use leptos::{html::*, *};
use leptos_icons::*;

use crate::store::query::QueryStore;

pub fn component(key: String) -> impl IntoView {
  let query_store = use_context::<QueryStore>().unwrap();
  let key_clone = key.clone();
  let splitted_key = create_memo(move |_| {
    let key = key_clone.clone();

    key
      .split(':')
      .map(|s| s.to_string())
      .collect::<Vec<String>>()
  });

  div()
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
            .child(splitted_key.clone().get()[1].clone()),
        )
        .on(ev::click, {
          let key = key.clone();
          move |_| {
            query_store.load_query(&key).unwrap();
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
            query_store.delete_query(&key).await.unwrap();
          })
        }),
    )
}
