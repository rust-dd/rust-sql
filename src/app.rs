use std::collections::VecDeque;

use leptos::*;
use leptos_toaster::{Toaster, ToasterPosition};

use crate::{
  dashboard::index::Dashboard,
  enums::QueryTableLayout,
  footer::Footer,
  performane::Performance,
  sidebar::index::Sidebar,
  store::{
    atoms::{QueryPerformanceAtom, QueryPerformanceContext, RunQueryAtom, RunQueryContext},
    projects::ProjectsStore,
    query::QueryStore,
    tabs::TabsStore,
  },
};

// TODO: help to add custom langunage support
// https://github.com/abesto/clox-rs/blob/def4bed61a1c1c6b5d84a67284549a6343c8cd06/web/src/monaco_lox.rs

#[component]
pub fn App() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(RwSignal::new(QueryTableLayout::Grid));
  provide_context::<QueryPerformanceContext>(
    RwSignal::new(VecDeque::<QueryPerformanceAtom>::new()),
  );
  provide_context::<RunQueryContext>(RwSignal::new(RunQueryAtom::default()));
  provide_context(TabsStore::default());

  view! {
      <Toaster position=ToasterPosition::TopCenter>
          <div class="flex h-screen">
              <Sidebar/>
              <div class="flex flex-col flex-1 overflow-hidden">
                  <main class="flex-1 relative overflow-y-scroll">
                      <Dashboard/>
                  </main>
                  <Footer/>
              </div>
              <div class="w-[240px] bg-white border-l-1 border-neutral-200">
                  <Performance/>
              </div>
          </div>
      </Toaster>
  }
}

