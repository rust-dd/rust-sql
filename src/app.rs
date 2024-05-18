use leptos::*;
use leptos_icons::*;
use leptos_toaster::{Toaster, ToasterPosition};
use thaw::{Button, ButtonSize, Tab, TabLabel, Tabs};

use crate::{
  enums::QueryTableLayout,
  footer::Footer,
  query_editor::QueryEditor,
  query_table::QueryTable,
  sidebar::index::Sidebar,
  store::{
    atoms::{
      ActiveTabAtom, ActiveTabContext, QueryPerformanceAtom, QueryPerformanceContext,
      SelectedTabAtom, SelectedTabContext,
    },
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
  provide_context(RwSignal::new(QueryTableLayout::Grid));
  provide_context::<QueryPerformanceContext>(RwSignal::new(Vec::<QueryPerformanceAtom>::new()));
  provide_context::<ActiveTabContext>(RwSignal::new(ActiveTabAtom::default()));
  provide_context::<SelectedTabContext>(RwSignal::new(SelectedTabAtom::default()));
  provide_context(TabsStore::default());
  let mut tabs = expect_context::<tabs::TabsStore>();

  view! {
      <Toaster position=ToasterPosition::TopCenter>
          <div class="flex h-screen">
              <Sidebar/>
              <div class="flex flex-col flex-1 overflow-hidden">
                  <main class="flex-1 relative overflow-y-scroll"></main>
                  <Footer/>
              </div>
              <div class="w-[240px] bg-white border-l-1 border-neutral-200">
                  <div class="p-4">
                      <p class="font-semibold text-lg">Database performance</p>
                      <div class="text-sm"></div>
                  </div>
              </div>
          </div>
      </Toaster>
  }
}

