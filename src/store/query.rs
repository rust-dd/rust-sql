use std::collections::BTreeMap;

use leptos::{error::Result, *};

use crate::{
  invoke::{
    Invoke, InvokeDeleteQueryArgs, InvokeInsertQueryArgs, InvokeSelectQueriesArgs,
    InvokeSqlResultArgs,
  },
  wasm_functions::invoke,
};

use super::{active_project::ActiveProjectStore, editor::EditorStore};

#[derive(Clone, Copy, Debug)]
pub struct QueryStore {
  #[allow(clippy::type_complexity)]
  pub sql_result: RwSignal<Option<(Vec<String>, Vec<Vec<String>>)>>,
  pub is_loading: RwSignal<bool>,
  pub saved_queries: RwSignal<BTreeMap<String, String>>,
}

impl Default for QueryStore {
  fn default() -> Self {
    Self::new()
  }
}

impl QueryStore {
  pub fn new() -> Self {
    Self {
      sql_result: create_rw_signal(None),
      is_loading: create_rw_signal(false),
      saved_queries: create_rw_signal(BTreeMap::new()),
    }
  }

  pub async fn run_query(&self) -> Result<()> {
    self.is_loading.update(|prev| {
      *prev = true;
    });
    let editor_state = use_context::<EditorStore>().unwrap();
    let position: monaco::sys::Position = editor_state
      .editor
      .get_untracked()
      .borrow()
      .as_ref()
      .unwrap()
      .as_ref()
      .get_position()
      .unwrap();
    let sql = editor_state.get_value();
    let sql = self
      .find_query_for_line(&sql, position.line_number())
      .unwrap();
    let active_project = use_context::<ActiveProjectStore>().unwrap();
    let args = serde_wasm_bindgen::to_value(&InvokeSqlResultArgs {
      project: active_project.0.get_untracked().unwrap(),
      sql: sql.query,
    })
    .unwrap();
    let data = invoke(&Invoke::select_sql_result.to_string(), args).await;
    let data = serde_wasm_bindgen::from_value::<(Vec<String>, Vec<Vec<String>>)>(data).unwrap();
    self.sql_result.set(Some(data));
    self.is_loading.update(|prev| {
      *prev = false;
    });
    Ok(())
  }

  pub async fn select_queries(&self) -> Result<BTreeMap<String, String>> {
    let args = serde_wasm_bindgen::to_value(&InvokeSelectQueriesArgs).unwrap_or_default();
    let saved_queries = invoke(&Invoke::select_queries.to_string(), args).await;
    let queries =
      serde_wasm_bindgen::from_value::<BTreeMap<String, String>>(saved_queries).unwrap();
    self.saved_queries.update(|prev| {
      *prev = queries.into_iter().collect();
    });
    Ok(self.saved_queries.get_untracked().clone())
  }

  #[allow(dead_code)]
  pub async fn insert_query(&self, key: &str, project_name: &str) -> Result<()> {
    let editor_state = use_context::<EditorStore>().unwrap();
    let sql = editor_state.get_value();
    let args = serde_wasm_bindgen::to_value(&InvokeInsertQueryArgs {
      key: format!("{}:{}", project_name, key),
      sql,
    });
    invoke(&Invoke::insert_query.to_string(), args.unwrap_or_default()).await;
    self.select_queries().await?;
    Ok(())
  }

  pub async fn delete_query(&self, key: &str) -> Result<()> {
    let args = serde_wasm_bindgen::to_value(&InvokeDeleteQueryArgs {
      key: key.to_string(),
    });
    invoke(&Invoke::delete_query.to_string(), args.unwrap_or_default()).await;
    self.select_queries().await?;
    Ok(())
  }

  pub fn load_query(&self, key: &str) -> Result<()> {
    let active_project = use_context::<ActiveProjectStore>().unwrap();
    let splitted_key = key.split(':').collect::<Vec<&str>>();
    active_project.0.set(Some(splitted_key[0].to_string()));
    let query = self.saved_queries.get_untracked().get(key).unwrap().clone();
    let editor_state = use_context::<EditorStore>().unwrap();
    editor_state.set_value(&query);
    Ok(())
  }

  // TODO: improve this
  fn find_query_for_line(&self, queries: &str, line_number: f64) -> Option<QueryInfo> {
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
            start_line,
            end_line: end_line - 1f64,
          });
        }
        start_line = end_line;
        current_query.clear();
      }
    }

    None
  }
}

#[derive(Clone, Debug)]
struct QueryInfo {
  query: String,
  #[allow(dead_code)]
  start_line: f64,
  #[allow(dead_code)]
  end_line: f64,
}
