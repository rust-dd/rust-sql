use leptos::{html::*, *};
use leptos_icons::*;

use crate::{enums::QueryTableLayout, store::active_project::ActiveProjectStore};

pub fn component() -> impl IntoView {
  let table_view = use_context::<RwSignal<QueryTableLayout>>().unwrap();
  let acitve_project = use_context::<ActiveProjectStore>().unwrap();
  let sql_timer = use_context::<RwSignal<f32>>().unwrap();
  let formatted_timer = create_memo(move |_| format!("Query complete: {}ms", sql_timer.get()));

  footer()
    .classes("flex flex-row justify-between items-center h-10 bg-gray-50 px-4")
    .child(
      div()
        .classes("flex flex-row gap-2 text-xs")
        .child(Show(ShowProps {
          children: ChildrenFn::to_children(move || {
            Fragment::new(vec![div()
              .classes("flex flex-row items-center gap-1")
              .child(p().child("Selected project:"))
              .child(
                p()
                  .classes("font-semibold")
                  .child(move || acitve_project.0.get()),
              )
              .into_view()])
          }),
          when: move || acitve_project.0.get().is_some(),
          fallback: ViewFn::from(div),
        })),
    )
    .child(
      div()
        .classes("flex flex-row gap-1 items-center text-xs")
        .child(p().child(formatted_timer))
        .child(
          button()
            .classes("p-1 hover:bg-gray-300 rounded-full")
            .class("bg-gray-300", move || {
              table_view() == QueryTableLayout::Records
            })
            .on(ev::click, move |_| {
              table_view.set(QueryTableLayout::Records)
            })
            .child(Icon(IconProps {
              icon: MaybeSignal::Static(icondata::HiBars4OutlineLg),
              width: MaybeProp::from(String::from("16")),
              height: MaybeProp::from(String::from("16")),
              class: MaybeProp::default(),
              style: MaybeProp::default(),
            })),
        )
        .child(
          button()
            .classes("p-1 hover:bg-gray-300 rounded-full")
            .class("bg-gray-300", move || {
              table_view() == QueryTableLayout::Grid
            })
            .on(ev::click, move |_| table_view.set(QueryTableLayout::Grid))
            .child(Icon(IconProps {
              icon: MaybeSignal::Static(icondata::HiTableCellsOutlineLg),
              width: MaybeProp::from(String::from("16")),
              height: MaybeProp::from(String::from("16")),
              class: MaybeProp::default(),
              style: MaybeProp::default(),
            })),
        ),
    )
}
