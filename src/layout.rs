use leptos::{html::*, *};

use crate::{footer, sidebar};

pub fn component(children: Children) -> impl IntoView {
  div()
    .classes("flex h-screen")
    .child(sidebar::index::component())
    .child(
      div()
        .classes("flex flex-col flex-1 overflow-hidden")
        .child(main().classes("flex-1 overflow-y-scroll").child(children()))
        .child(footer::component()),
    )
}
