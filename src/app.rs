use leptos::*;
use thaw::{Button, Tab, Tabs};

use crate::{
  enums::QueryTableLayout,
  query_editor, query_table, sidebar,
  store::{
    active_project::ActiveProjectStore,
    projects::ProjectsStore,
    query::QueryStore,
    tabs::{self, TabsStore},
  },
};

// TODO: help to add custom langunage support
// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs

#[component]
pub fn App() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(create_rw_signal(0.0f32));
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());
  let tabs = use_context::<tabs::TabsStore>().unwrap();

  view! {
      <div class="flex h-screen">
          {sidebar::index::component()} <div>
              <main>
                  <Tabs value=tabs.selected_tab>
                      <For
                          each=move || (0..tabs.active_tabs.get())
                          key=|index| index.to_string()
                          children=move |index| {
                              view! {
                                  <Tab key=index
                                      .to_string()>
                                      {query_editor::component().into_view()}
                                      {query_table::component().into_view()}
                                  </Tab>
                              }
                          }
                      />

                  </Tabs>
                  <Button
                      class="absolute top-2 right-2"
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

                      {"+"}
                  </Button>
              </main>
          </div>
      </div>
  }
}

