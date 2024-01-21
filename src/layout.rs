use leptos::{html::*, *};
use thaw::{
  Button,
  Tab,
  //TabProps,
  Tabs,
  // TabsProps
};

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
            .child(
              view! {
                <Tabs value=tabs.selected_tab>
                    <For each=move || (0..tabs.active_tabs.get()) key=|index| index.to_string() let:index>
                        <Tab key=index.to_string() label=(index + 1).to_string()>
                            {query_editor::component()}
                            {query_table::component()}
                        </Tab>
                    </For>
                  </Tabs>
                  <Button on_click=move |_| {
                    tabs.active_tabs.update(|prev| *prev += 1);
                    tabs.selected_tab.update(|prev| *prev = (tabs.active_tabs.get() - 1).to_string());
                  }>"+1"</Button>
            }),
            // .child(Tabs(TabsProps {
            //   value: tabs.selected_tab,
            //   class: MaybeSignal::Static(String::new()),
            //   children: Children::to_children(move || {
            //     Fragment::new(vec![
            //       For(ForProps {
            //         each: move || (0..tabs.active_tabs.get()),
            //         key: |index| index.to_string(),
            //         children: move |index| {
            //           Tab(TabProps {
            //             class: MaybeSignal::Static(String::new()),
            //             key: index.to_string(),
            //             label: (index + 1).to_string(),
            //             children: Children::to_children(move || {
            //               Fragment::new(vec![
            //                 query_editor::component().into_view(),
            //                 query_table::component().into_view(),
            //               ])
            //             }),
            //           })
            //         },
            //       })
            //       .into_view(),
            //       button()
            //         .on(ev::click, move |_| {
            //           tabs.active_tabs.update(|prev| *prev += 1);
            //           tabs
            //             .selected_tab
            //             .update(|prev| *prev = (tabs.active_tabs.get() - 1).to_string());
            //         })
            //         .child("+")
            //         .into_view(),
            //     ])
            //   }),
            // })),
        )
        .child(footer::component()),
    )
}
