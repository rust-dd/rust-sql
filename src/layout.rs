use crate::{db_connector::db_connector, footer::footer_layout, sidebar::sidebar};
use leptos::{html::*, *};

pub fn layout(children: Children) -> impl IntoView {
  div().classes("flex h-screen").child(sidebar()).child(
    div()
      .classes("flex flex-col flex-1 overflow-hidden")
      .child(db_connector())
      .child(main().classes("flex-1 overflow-y-scroll").child(children()))
      .child(footer_layout()),
  )
}
