use std::{cell::RefCell, rc::Rc};

use common::enums::ProjectConnectionStatus;
use leptos::{create_rw_signal, expect_context, RwSignal, SignalGet, SignalSet, SignalUpdate};
use monaco::api::CodeEditor;
use rsql::set_running_query;
use tauri_sys::tauri::invoke;

use crate::{
  dashboard::query_editor::ModelCell,
  invoke::{Invoke, InvokePgsqlConnectorArgs, InvokePgsqlRunQueryArgs},
};

use super::atoms::{QueryPerformanceAtom, QueryPerformanceContext, RunQueryAtom, RunQueryContext};

struct QueryInfo {
  query: String,
  _start_line: f64,
  _end_line: f64,
}

#[derive(Copy, Clone, Debug)]
pub struct TabsStore {
  pub selected_tab: RwSignal<String>,
  pub active_tabs: RwSignal<usize>,
  pub editors: RwSignal<Vec<ModelCell>>,
  #[allow(clippy::type_complexity)]
  pub sql_results: RwSignal<Vec<(Vec<String>, Vec<Vec<String>>)>>,
  pub selected_projects: RwSignal<Vec<String>>,
}

unsafe impl Send for TabsStore {}
unsafe impl Sync for TabsStore {}

impl Default for TabsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl TabsStore {
  #[must_use]
  pub fn new() -> Self {
    Self {
      selected_tab: create_rw_signal(String::from("0")),
      active_tabs: create_rw_signal(1),
      editors: create_rw_signal(Vec::new()),
      sql_results: create_rw_signal(Vec::new()),
      selected_projects: create_rw_signal(Vec::new()),
    }
  }

  #[set_running_query]
  pub async fn run_query(&self) {
    let project_ids = self.selected_projects.get();
    let project_id = project_ids
      .get(self.convert_selected_tab_to_index())
      .unwrap();
    let active_editor = self.select_active_editor();
    let position = active_editor
      .borrow()
      .as_ref()
      .unwrap()
      .as_ref()
      .get_position()
      .unwrap();
    let sql = self.select_active_editor_value();
    let sql = self
      .find_query_for_line(&sql, position.line_number())
      .unwrap();
    let (cols, rows, query_time) = invoke::<_, (Vec<String>, Vec<Vec<String>>, f32)>(
      &Invoke::PgsqlRunQuery.to_string(),
      &InvokePgsqlRunQueryArgs {
        project_id,
        sql: &sql.query,
      },
    )
    .await
    .unwrap();
    self.sql_results.update(|prev| {
      let index = self.convert_selected_tab_to_index();
      match prev.get_mut(index) {
        Some(sql_result) => *sql_result = (cols, rows),
        None => prev.push((cols, rows)),
      }
    });
    let qp_store = expect_context::<QueryPerformanceContext>();
    qp_store.update(|prev| {
      let new = QueryPerformanceAtom::new(prev.len(), &sql.query, query_time);
      prev.push_front(new);
    });
  }

  // TODO: Need to be more generic if we want to support other databases
  pub async fn load_query(&self, query_id: &str, sql: &str) {
    let splitted_key = query_id.split(':').collect::<Vec<&str>>();
    let selected_projects = self.selected_projects.get();
    let project_id = selected_projects.get(self.convert_selected_tab_to_index());
    if !self.selected_projects.get().is_empty()
      && project_id.is_some_and(|id| id.as_str() != splitted_key[0])
    {
      self.add_tab(&splitted_key[0]);
    }
    self.set_editor_value(sql);
    self.selected_projects.update(|prev| {
      let index = self.convert_selected_tab_to_index();
      match prev.get_mut(index) {
        Some(project) => *project = splitted_key[0].to_string(),
        None => prev.push(splitted_key[0].to_string()),
      }
    });
    let _ = invoke::<_, ProjectConnectionStatus>(
      Invoke::PgsqlConnector.as_ref(),
      &InvokePgsqlConnectorArgs {
        project_id: splitted_key[0],
        key: None,
      },
    )
    .await;
    self.run_query().await;
  }

  pub fn add_editor(&mut self, editor: Rc<RefCell<Option<CodeEditor>>>) {
    self.editors.update(|prev| {
      prev.push(editor);
    });
  }

  pub fn add_tab(&self, project_id: &str) {
    if self.editors.get().len() == 1 && self.selected_projects.get().is_empty() {
      self.selected_projects.update(|prev| {
        prev.push(project_id.to_string());
      });
      return;
    }

    self.active_tabs.update(|prev| {
      *prev += 1;
    });

    self.selected_tab.update(|prev| {
      *prev = (self.active_tabs.get() - 1).to_string();
    });

    self.selected_projects.update(|prev| {
      prev.push(project_id.to_string());
    });
  }

  pub fn close_tab(&self, index: usize) {
    if self.active_tabs.get() == 1 {
      return;
    }

    self.selected_tab.update(|prev| {
      *prev = (index - 1).to_string();
    });

    self.active_tabs.update(|prev| {
      *prev -= 1;
    });

    self.editors.update(|prev| {
      prev.remove(index);
    });
  }

  pub fn select_active_editor_sql_result(&self) -> Option<(Vec<String>, Vec<Vec<String>>)> {
    self
      .sql_results
      .get()
      .get(self.convert_selected_tab_to_index())
      .cloned()
  }

  pub fn select_active_editor(&self) -> ModelCell {
    self
      .editors
      .get()
      .get(self.convert_selected_tab_to_index())
      .unwrap()
      .clone()
  }

  pub fn select_active_editor_value(&self) -> String {
    self
      .editors
      .get()
      .get(self.convert_selected_tab_to_index())
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
      .get()
      .get(self.convert_selected_tab_to_index())
      .unwrap()
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(value);
  }

  pub fn convert_selected_tab_to_index(&self) -> usize {
    self.selected_tab.get().parse::<usize>().unwrap()
  }

  pub(self) fn find_query_for_line(&self, queries: &str, line_number: f64) -> Option<QueryInfo> {
    let mut start_line = 1f64;
    let mut end_line = 1f64;
    let mut current_query = String::new();

    for line in queries.lines() {
      if !current_query.is_empty() {
        current_query.push('\n');
      }
      current_query.push_str(line);
      end_line += 1f64;

      if line.ends_with(';') {
        if line_number >= start_line && line_number < end_line {
          return Some(QueryInfo {
            query: current_query.clone(),
            _start_line: start_line,
            _end_line: end_line - 1f64,
          });
        }
        start_line = end_line;
        current_query.clear();
      }
    }

    None
  }
}

