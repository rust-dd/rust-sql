use leptos::ev::MouseEvent;

use crate::invoke::{InvokeContextMenuArgs, InvokeContextMenuItem, InvokeContextMenuPosition};

pub fn context_menu<'a>(event: &MouseEvent) -> InvokeContextMenuArgs<'a> {
  InvokeContextMenuArgs {
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
  }
}
