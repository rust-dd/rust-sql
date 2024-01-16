use futures::StreamExt;
use leptos::{html::*, *};
use leptos_use::use_event_listener;
use tauri_sys::{event::listen, tauri::invoke};
use web_sys::MouseEvent;

use crate::invoke::{Invoke, InvokeContextMenuArgs};

pub fn use_context_menu<F>(f: F) -> NodeRef<Div>
where
  F: Fn(&MouseEvent) -> InvokeContextMenuArgs<'static> + 'static + Clone,
{
  let node_ref = create_node_ref();
  let _ = use_event_listener(node_ref, ev::contextmenu, move |event| {
    let f = f.clone();
    spawn_local(async move {
      invoke::<_, ()>(&Invoke::plugin_context_menu.to_string(), &f(&event))
        .await
        .unwrap();
    });
  });

  spawn_local(async move {
    let mut evt = listen::<String>("my_first_item").await.expect("error");
    while let Some(event) = evt.next().await {
      logging::log!("{:?}", event.payload);
    }
  });

  node_ref
}
