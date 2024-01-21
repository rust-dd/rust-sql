use leptos::{create_rw_signal, RwSignal};

#[derive(Clone, Debug)]
pub struct Tabs {
  pub active_tabs: RwSignal<usize>,
  pub selected_tab: RwSignal<String>,
}

impl Default for Tabs {
  fn default() -> Self {
    Self::new()
  }
}

impl Tabs {
  pub fn new() -> Self {
    Self {
      active_tabs: create_rw_signal(1),
      selected_tab: create_rw_signal(String::from("0")),
    }
  }
}
