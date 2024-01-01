use crate::{footer, header, sidebar::index};
use leptos::{html::*, *};

pub fn component(children: Children) -> impl IntoView {
  div()
    .classes("flex h-screen")
    .child(index::component())
    .child(
      div()
        .classes("flex flex-col flex-1 overflow-hidden")
        .child(header::component())
        .child(main().classes("flex-1 overflow-y-scroll").child(children()))
        .child(footer::component()),
    )
}
