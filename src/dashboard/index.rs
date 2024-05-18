use leptos::*;
use leptos_icons::Icon;
use thaw::{Tab, TabLabel, Tabs};

use crate::store::tabs;

use super::{query_editor::QueryEditor, query_table::QueryTable};

#[component]
pub fn Dashboard() -> impl IntoView {
  let mut tabs = expect_context::<tabs::TabsStore>();

  view! {
      <Tabs value=tabs.selected_tab>
          <For
              each=move || (0..(tabs.selected_tab.get().parse::<usize>().unwrap_or_default() + 1))
              key=|index| index.to_string()
              children=move |index| {
                  view! {
                      <div>
                          <Tab key=index.to_string()>
                              <TabLabel slot>
                                  <div class="flex flex-row items-center justify-between gap-2 h-full text-sm">
                                      <span>{format!("Tab {}", index + 1)}</span>
                                      <button
                                          class="rounded-full p-1 hover:bg-gray-100"
                                          on:click=move |_| { tabs.remove_editor(index) }
                                      >

                                          <Icon icon=icondata::CgClose width="16" height="16"/>
                                      </button>
                                  </div>
                              </TabLabel>
                              <QueryEditor/>
                              <QueryTable/>
                          </Tab>
                      </div>
                  }
              }
          />

      </Tabs>
  }
}

