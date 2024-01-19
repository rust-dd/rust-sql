use leptos::{html::*, *};
use thaw::{Tab, TabProps, Tabs, TabsProps};

use crate::{footer, query_editor, query_table, sidebar, store};

pub fn component() -> impl IntoView {
  let tabs = use_context::<store::tabs::Tabs>().unwrap();

  div()
    .classes("flex h-screen")
    .child(sidebar::index::component())
    .child(
      div()
        .classes("flex flex-col flex-1 overflow-hidden")
        .child(
          main()
            .classes("flex-1 overflow-y-scroll")
            .child(Tabs(TabsProps {
              value: tabs.selected_tab,
              class: MaybeSignal::Static(String::from("flex flex-col")),
              children: Children::to_children(move || {
                Fragment::new(
                  (0..tabs.active_tabs.get())
                    .map(|index| {
                      Tab(TabProps {
                        key: index.to_string(),
                        label: (index + 1).to_string(),
                        class: MaybeSignal::Static(String::from("flex-1")),
                        children: Children::to_children(move || {
                          Fragment::new(vec![div()
                            .child(query_editor::component(index))
                            .child(query_table::component())
                            .into_view()])
                        }),
                      })
                      .into_view()
                    })
                    .collect::<Vec<_>>(),
                )
              }),
            })),
        )
        .child(footer::component()),
    )
}
