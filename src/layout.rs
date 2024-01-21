use leptos::{html::*, *};
use thaw::{Button, ButtonProps, Tab, TabProps, Tabs, TabsProps};

use crate::{footer, query_editor, query_table, sidebar, store::tabs};

pub fn component() -> impl IntoView {
  let tabs = use_context::<tabs::Tabs>().unwrap();

  div()
    .classes("flex h-screen")
    .child(sidebar::index::component())
    .child(
      div()
        .classes("flex flex-col flex-1 overflow-hidden")
        .child(
          main()
            .classes("flex-1 overflow-y-scroll")
            .child(div().child(Tabs(TabsProps {
              value: tabs.selected_tab,
              class: MaybeSignal::default(),
              children: Children::to_children(move || {
                Fragment::new(vec![For(ForProps {
                  each: move || (0..tabs.active_tabs.get()),
                  key: |index| index.to_string(),
                  children: move |index| {
                    Fragment::new(vec![Tab(TabProps {
                      class: MaybeSignal::default(),
                      key: index.to_string(),
                      label: (index + 1).to_string(),
                      children: Children::to_children(move || {
                        Fragment::new(vec![
                          query_editor::component().into_view(),
                          query_table::component().into_view(),
                        ])
                      }),
                    })
                    .into_view()])
                  },
                })
                .into_view()])
              }),
            })))
            .child(Button(ButtonProps {
              style: MaybeSignal::default(),
              class: MaybeSignal::Static(String::from("absolute top-2 right-2")),
              variant: MaybeSignal::default(),
              color: MaybeSignal::default(),
              size: MaybeSignal::default(),
              round: MaybeSignal::default(),
              circle: MaybeSignal::default(),
              icon: None,
              loading: MaybeSignal::default(),
              disabled: MaybeSignal::default(),
              on_click: Some(Callback::from(move |_| {
                tabs.active_tabs.update(|prev| *prev += 1);
                tabs
                  .selected_tab
                  .update(|prev| *prev = (tabs.active_tabs.get() - 1).to_string());
              })),
              children: Some(Box::new(move || {
                Fragment::new(vec![p().child("+").into_view()])
              })),
            })),
        )
        .child(footer::component()),
    )
}
