use std::{cell::RefCell, rc::Rc};

use leptos::{create_rw_signal, use_context, RwSignal, SignalGetUntracked, SignalUpdate};
use monaco::api::CodeEditor;

use crate::query_editor::ModelCell;

use super::tabs::Tabs;

#[derive(Clone, Debug)]
pub struct EditorStore {
  pub editors: RwSignal<Vec<RwSignal<ModelCell>>>,
}

impl Default for EditorStore {
  fn default() -> Self {
    Self::new()
  }
}

impl EditorStore {
  pub fn new() -> Self {
    Self {
      editors: create_rw_signal(Vec::new()),
    }
  }

  pub fn add_editor(&mut self, editor: Rc<RefCell<Option<CodeEditor>>>) {
    self.editors.update(|prev| {
      prev.push(create_rw_signal(editor));
    });
  }

  #[allow(dead_code)]
  pub fn remove_editor(&mut self, index: usize) {
    self.editors.update(|prev| {
      prev.remove(index);
    });
  }

  pub fn get_active_editor(&self) -> RwSignal<ModelCell> {
    let selected_tab = use_context::<Tabs>().unwrap().selected_tab.get_untracked();
    let selected_tab = selected_tab.parse::<usize>().unwrap();

    self.editors.get_untracked()[selected_tab]
  }

  pub fn get_editor_value(&self) -> String {
    let selected_tab = use_context::<Tabs>().unwrap().selected_tab.get_untracked();
    let selected_tab = selected_tab.parse::<usize>().unwrap();

    self.editors.get_untracked()[selected_tab]
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
    let selected_tab = selected_tab.parse::<usize>().unwrap();

    self.editors.get_untracked()[selected_tab]
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(value);
  }
}
