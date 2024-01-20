use leptos::{html::*, *};

use crate::{
  footer, query_editor, query_table, sidebar,
  store::{self, editor::EditorStore},
};

pub fn component() -> impl IntoView {
  let tabs = use_context::<store::tabs::Tabs>().unwrap();
  let mut editors = use_context::<EditorStore>().unwrap();

  div()
    .classes("flex h-screen")
    .child(sidebar::index::component())
    .child(
      div()
        .classes("flex flex-col flex-1 overflow-hidden")
        .child(
          main()
            .classes("flex-1 overflow-y-scroll")
            .child(
              div()
                .classes("flex")
                .child(For(ForProps {
                  each: move || (0..tabs.active_tabs.get()),
                  key: |index| *index,
                  children: move |index| {
                    button()
                      .classes("px-8 h-10 hover:bg-gray-200 border-b-2")
                      .class("border-indigo-500", move || {
                        index == tabs.selected_tab.get()
                      })
                      .on(ev::click, move |_| {
                        tabs.selected_tab.update(|prev| *prev = index);
                      })
                      .child((index + 1).to_string())
                  },
                }))
                .child(
                  button()
                    .classes("px-8 h-10 border-b-2 hover:bg-gray-200")
                    .on(ev::click, move |_| {
                      tabs.active_tabs.update(|prev| *prev += 1);
                      tabs.selected_tab.update(|prev| *prev += 1);
                      editors.add_editor();
                    })
                    .child("+"),
                ),
            )
            .child(
              div()
                .child(query_editor::component(move || tabs.selected_tab.get()))
                .child(query_table::component()),
            ),
        )
        .child(footer::component()),
    )
}
