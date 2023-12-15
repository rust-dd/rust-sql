use crate::{db_connector::db_connector, enums::QueryTableLayout, sidebar::sidebar};
use leptos::{html::*, *};
use leptos_icons::*;

pub fn layout(children: Children) -> impl IntoView {
  let table_view = create_rw_signal(QueryTableLayout::Grid);
  logging::log!("{:?}", table_view);
  provide_context(table_view);

  div().classes("flex h-screen").child(sidebar()).child(
    div()
      .classes("flex flex-col flex-1 overflow-hidden")
      .child(db_connector())
      .child(main().classes("flex-1 overflow-y-scroll").child(children()))
      .child(
        footer()
          .classes("flex flex-row justify-end items-center h-10 bg-gray-50 px-4")
          .child(
            div()
              .classes("flex flex-row gap-1")
              .child(
                button()
                  .classes("p-1 rounded-full hover:bg-gray-300")
                  .on(ev::click, move |_| {
                    table_view.set(QueryTableLayout::Records)
                  })
                  .child(Icon(IconProps {
                    icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiBars4OutlineLg)),
                    width: Some(MaybeSignal::derive(|| String::from("16"))),
                    height: Some(MaybeSignal::derive(|| String::from("16"))),
                    class: None,
                    style: None,
                  })),
              )
              .child(
                button()
                  .classes("p-1 rounded-full hover:bg-gray-300")
                  .on(ev::click, move |_| table_view.set(QueryTableLayout::Grid))
                  .child(Icon(IconProps {
                    icon: MaybeSignal::derive(|| Icon::from(HiIcon::HiTableCellsOutlineLg)),
                    width: Some(MaybeSignal::derive(|| String::from("16"))),
                    height: Some(MaybeSignal::derive(|| String::from("16"))),
                    class: None,
                    style: None,
                  })),
              ),
          ),
      ),
  )
}
