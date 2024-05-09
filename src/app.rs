use leptos::*;
use leptos_icons::*;
use thaw::{Button, ButtonSize, Tab, TabLabel, Tabs};

use crate::{
  enums::QueryTableLayout,
  footer::Footer,
  query_editor::QueryEditor,
  query_table::QueryTable,
  sidebar::index::Sidebar,
  store::{
    active_project::ActiveProjectStore,
    projects::ProjectsStore,
    query::QueryStore,
    tabs::{self, TabsStore},
  },
};

// TODO: help to add custom langunage support
// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs

#[derive(Default, Clone)]
pub struct ErrorModal {
  pub message: String,
  pub show: RwSignal<bool>,
}

#[component]
pub fn App() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(create_rw_signal(0.0f32));
  provide_context(ErrorModal::default());
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());
  let mut tabs = use_context::<tabs::TabsStore>().unwrap();

  view! {
      <div class="flex h-screen">
          <Sidebar/>
          <div class="flex flex-col flex-1 overflow-hidden">
              <main class="flex-1 overflow-y-scroll">
                  <Tabs value=tabs.selected_tab>
                      <For
                          each=move || (0..tabs.active_tabs.get())
                          key=|index| index.to_string()
                          children=move |index| {
                              view! {
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
                              }
                          }
                      />

                  </Tabs>
                  <Button
                      size=ButtonSize::Small
                      icon=icondata::TbPlus
                      class="absolute top-2 right-2 text-sm"
                      on:click=move |_| {
                          tabs.active_tabs.update(|prev| *prev += 1);
                          tabs.selected_tab
                              .update(|prev| {
                                  *prev = if *prev == "0" {
                                      "1".to_string()
                                  } else {
                                      (tabs.active_tabs.get() - 1).to_string()
                                  }
                              });
                      }
                  >

                      {"Add Tab"}
                  </Button>
              </main>
              <Footer/>
          </div>
      </div>
  }
}

