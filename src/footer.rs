use leptos::{html::*, *};
use leptos_icons::*;

use crate::enums::QueryTableLayout;

pub fn footer_layout() -> impl IntoView {
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();

  footer()
    .classes("flex flex-row justify-end items-center h-10 bg-gray-50 px-4")
    .child(
      div()
        .classes("flex flex-row gap-1")
        .child(Show(ShowProps {
          children: ChildrenFn::to_children(move || {
            Fragment::new(vec![button()
              .classes("p-1 bg-gray-300 rounded-full")
              .child(Icon(IconProps {
                icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiBars4OutlineLg)),
                width: Some(MaybeSignal::derive(|| String::from("16"))),
                height: Some(MaybeSignal::derive(|| String::from("16"))),
                class: None,
                style: None,
              }))
              .into_view()])
          }),
          when: move || table_view() == QueryTableLayout::Records,
          fallback: ViewFn::from(move || {
            div()
              .classes("p-1 hover:bg-gray-300 rounded-full")
              .on(ev::click, move |_| {
                table_view.set(QueryTableLayout::Records)
              })
              .child(Icon(IconProps {
                icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiBars4OutlineLg)),
                width: Some(MaybeSignal::derive(|| String::from("16"))),
                height: Some(MaybeSignal::derive(|| String::from("16"))),
                class: None,
                style: None,
              }))
          }),
        }))
        .child(Show(ShowProps {
          children: ChildrenFn::to_children(move || {
            Fragment::new(vec![button()
              .classes("p-1 bg-gray-300 rounded-full")
              .child(Icon(IconProps {
                icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiTableCellsOutlineLg)),
                width: Some(MaybeSignal::derive(|| String::from("16"))),
                height: Some(MaybeSignal::derive(|| String::from("16"))),
                class: None,
                style: None,
              }))
              .into_view()])
          }),
          when: move || table_view() == QueryTableLayout::Grid,
          fallback: ViewFn::from(move || {
            div()
              .classes("p-1 hover:bg-gray-300 rounded-full")
              .on(ev::click, move |_| table_view.set(QueryTableLayout::Grid))
              .child(Icon(IconProps {
                icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiTableCellsOutlineLg)),
                width: Some(MaybeSignal::derive(|| String::from("16"))),
                height: Some(MaybeSignal::derive(|| String::from("16"))),
                class: None,
                style: None,
              }))
          }),
        })),
    )
}
