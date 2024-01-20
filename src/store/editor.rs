use leptos::{create_rw_signal, logging, use_context, RwSignal, SignalGetUntracked};

use crate::query_editor::ModelCell;

use super::tabs::Tabs;

#[derive(Clone, Debug)]
pub struct EditorStore {
  pub editors: Vec<RwSignal<ModelCell>>,
}

impl Default for EditorStore {
  fn default() -> Self {
    Self::new()
  }
}

impl EditorStore {
  pub fn new() -> Self {
    Self {
      editors: vec![create_rw_signal(ModelCell::default())],
    }
  }

  pub fn add_editor(&mut self) {
    self.editors.push(create_rw_signal(ModelCell::default()));
  }

  pub fn remove_editor(&mut self, index: usize) {
    self.editors.remove(index);
  }

  pub fn get_active_editor(&self) -> RwSignal<ModelCell> {
    let selected_tab = use_context::<Tabs>().unwrap().selected_tab.get_untracked();

    self.editors[selected_tab].clone()
  }

  pub fn get_editor_value(&self) -> String {
    let selected_tab = use_context::<Tabs>().unwrap().selected_tab.get_untracked();

    self.editors[selected_tab]
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .get_value()
  }

  pub fn set_editor_value(&self, value: &str) {
    let selected_tab = use_context::<Tabs>().unwrap().selected_tab.get_untracked();

    self.editors[selected_tab]
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(value);
  }
}
