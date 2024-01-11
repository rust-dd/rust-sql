use crate::{
  footer,
  invoke::{InvokeContextMenuArgs, InvokeContextMenuItem, InvokeContextMenuPosition},
  sidebar,
};
use leptos::{html::*, *};
use leptos_use::{use_document, use_event_listener};

use futures::stream::StreamExt;
use tauri_sys::{event::listen, tauri::invoke};

pub fn component(children: Children) -> impl IntoView {
  spawn_local(async move {
    let mut evt = listen::<String>("my_first_item").await.expect("error");
    while let Some(event) = evt.next().await {
      logging::log!("{:?}", event.payload);
    }
  });
  let _ = use_event_listener(use_document(), ev::contextmenu, |event| {
    logging::log!("{:?}", event.client_x());
    logging::log!("{:?}", event.client_y());
    spawn_local(async move {
      let res = invoke::<_, ()>(
        "plugin:context_menu|show_context_menu",
        &InvokeContextMenuArgs {
          pos: Some(InvokeContextMenuPosition {
            x: event.x() as f64,
            y: event.y() as f64,
            is_absolute: Some(true),
          }),
          items: Some(vec![InvokeContextMenuItem {
            label: Some("test"),
            event: Some("my_first_item"),
            payload: Some("test2"),
            ..Default::default()
          }]),
        },
      )
      .await
      .expect("");
    });
  });
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
