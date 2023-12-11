use leptos::{create_rw_signal, RwSignal};

use crate::query_editor::ModelCell;

#[derive(Copy, Clone, Debug)]
pub struct EditorState {
  pub editor: RwSignal<ModelCell>,
}

impl Default for EditorState {
  fn default() -> Self {
    Self::new()
  }
}

impl EditorState {
  pub fn new() -> Self {
    Self {
      editor: create_rw_signal(ModelCell::default()),
    }
  }
}
