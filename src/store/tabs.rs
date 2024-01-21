use std::{
  cell::RefCell,
  collections::{BTreeMap, HashMap},
  rc::Rc,
};

use leptos::{create_rw_signal, RwSignal, SignalGetUntracked, SignalUpdate};
use monaco::api::CodeEditor;

use crate::query_editor::ModelCell;

#[derive(Clone, Debug)]
pub struct Tabs {
  pub active_tabs: RwSignal<usize>,
  pub selected_tab: RwSignal<String>,
  pub editors: RwSignal<BTreeMap<String, ModelCell>>,
  pub sql_results: RwSignal<Vec<RwSignal<Option<(usize, Vec<String>, Vec<Vec<String>>)>>>>,
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
      editors: create_rw_signal(BTreeMap::new()),
      sql_results: create_rw_signal(Vec::new()),
    }
  }

  pub fn add_editor(&mut self, tab_key: &str, editor: Rc<RefCell<Option<CodeEditor>>>) {
    self.editors.update(|prev| {
      prev.insert(tab_key.to_string(), editor);
    });
  }

  pub fn remove_editor(&mut self, tab_key: &str) {
    self.editors.update(|prev| {
      prev.remove(tab_key);
    });
  }

  pub fn get_active_editor(&self) -> ModelCell {
    self
      .editors
      .get_untracked()
      .get(&self.selected_tab.get_untracked())
      .unwrap()
      .clone()
  }

  pub fn get_editor_value(&self) -> String {
    self
      .editors
      .get_untracked()
      .get(&self.selected_tab.get_untracked())
      .unwrap()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .get_value()
  }

  pub fn set_editor_value(&self, value: &str) {
    self
      .editors
      .get_untracked()
      .get(&self.selected_tab.get_untracked())
      .unwrap()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(value);
  }
}
