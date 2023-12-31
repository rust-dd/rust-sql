use leptos::{create_rw_signal, RwSignal, SignalGetUntracked};

use crate::query_editor::ModelCell;

#[derive(Copy, Clone, Debug)]
pub struct EditorStore {
  pub editor: RwSignal<ModelCell>,
}

impl Default for EditorStore {
  fn default() -> Self {
    Self::new()
  }
}

impl EditorStore {
  pub fn new() -> Self {
    Self {
      editor: create_rw_signal(ModelCell::default()),
    }
  }

  pub fn get_value(&self) -> String {
    self
      .editor
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .get_value()
  }

  pub fn set_value(&self, value: &str) {
    self
      .editor
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(value);
  }
}
