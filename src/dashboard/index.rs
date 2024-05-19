use leptos::{logging::log, *};
use leptos_icons::Icon;
use thaw::{Tab, TabLabel, Tabs};

use crate::store::tabs;

use super::{query_editor::QueryEditor, query_table::QueryTable};

#[component]
pub fn Dashboard() -> impl IntoView {
  let tabs_store = expect_context::<tabs::TabsStore>();
  create_effect(move |_| {
    log!("Selected tab: {}", tabs_store.selected_tab.get());
  });

  view! {
      <Tabs value=tabs_store.selected_tab>
          <For
              each=move || (0..(tabs_store.active_tabs.get()))
              key=|index| index.to_string()
              children=move |index| {
                  view! {
                      <Tab key=index.to_string()>
                          <TabLabel slot>
                              <div class="flex flex-row items-center justify-between gap-2 h-full text-sm">
                                  <span>{format!("Tab {}", index + 1)}</span>
                                  <button
                                      class="rounded-full p-1 hover:bg-gray-100"
                                      on:click=move |_| { tabs_store.close_tab(index) }
                                  >

                                      <Icon icon=icondata::CgClose width="16" height="16"/>
                                  </button>
                              </div>
                          </TabLabel>
                          <QueryEditor/>
                          <QueryTable/>
                      </Tab>
                  }
              }
          />

      </Tabs>
  }
}

