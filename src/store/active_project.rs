use leptos::{create_rw_signal, RwSignal};

#[derive(Clone, Debug)]
pub struct ActiveProjectStore(pub RwSignal<Option<String>>);

impl Default for ActiveProjectStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ActiveProjectStore {
  pub fn new() -> Self {
    Self(create_rw_signal(None))
  }
}
