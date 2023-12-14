use std::collections::BTreeMap;

use leptos::*;

use crate::{
  invoke::{
    Invoke, InvokeDeleteQueryArgs, InvokeInsertQueryArgs, InvokeQueryArgs, InvokeSelectQueriesArgs,
  },
  wasm_functions::invoke,
};

use super::editor::EditorState;

#[derive(Clone, Copy, Debug)]
pub struct QueryState {
  pub sql: RwSignal<String>,
  #[allow(clippy::type_complexity)]
  pub sql_result: RwSignal<Option<(Vec<String>, Vec<Vec<String>>)>>,
  pub is_loading: RwSignal<bool>,
  pub saved_queries: RwSignal<BTreeMap<String, String>>,
}

impl Default for QueryState {
  fn default() -> Self {
    Self::new()
  }
}

impl QueryState {
  pub fn new() -> Self {
    Self {
      sql: create_rw_signal(String::from("SELECT * FROM users LIMIT 100;")),
      sql_result: create_rw_signal(Some((Vec::new(), Vec::new()))),
      is_loading: create_rw_signal(false),
      saved_queries: create_rw_signal(BTreeMap::new()),
    }
  }

  pub async fn run_query(&self) {
    self.is_loading.update(|prev| {
      *prev = true;
    });
    let editor = use_context::<EditorState>().unwrap().editor.get_untracked();
    let code = editor
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .get_value();
    let args = serde_wasm_bindgen::to_value(&InvokeQueryArgs {
      sql: code.to_string(),
    })
    .unwrap();
    let data = invoke(&Invoke::select_sql_result.to_string(), args).await;
    let data = serde_wasm_bindgen::from_value::<(Vec<String>, Vec<Vec<String>>)>(data).unwrap();
    self.sql_result.update(|prev| {
      *prev = Some(data);
    });
    self.is_loading.update(|prev| {
      *prev = false;
    });
  }

  pub async fn select_queries(&self) -> Result<(), ()> {
    let args = serde_wasm_bindgen::to_value(&InvokeSelectQueriesArgs).unwrap_or_default();
    let saved_queries = invoke(&Invoke::select_queries.to_string(), args).await;
    let queries =
      serde_wasm_bindgen::from_value::<BTreeMap<String, String>>(saved_queries).unwrap();
    self.saved_queries.update(|prev| {
      *prev = queries.into_iter().collect();
    });
    Ok(())
  }

  pub async fn insert_query(&self, key: &str) -> Result<(), ()> {
    let editor = use_context::<EditorState>().unwrap().editor.get_untracked();
    let sql = editor
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .get_value();
    let args = serde_wasm_bindgen::to_value(&InvokeInsertQueryArgs {
      key: key.to_string(),
      sql: sql.to_string(),
    });
    invoke(&Invoke::insert_query.to_string(), args.unwrap_or_default()).await;
    self.select_queries().await?;
    Ok(())
  }

  pub async fn delete_query(&self, key: &str) -> Result<(), ()> {
    let args = serde_wasm_bindgen::to_value(&InvokeDeleteQueryArgs {
      key: key.to_string(),
    });
    invoke(&Invoke::delete_query.to_string(), args.unwrap_or_default()).await;
    self.select_queries().await?;
    Ok(())
  }

  pub fn load_query(&self, key: &str) -> () {
    let query = self.saved_queries.get_untracked().get(key).unwrap().clone();
    let editor = use_context::<EditorState>().unwrap().editor.get_untracked();
    editor
      .borrow()
      .as_ref()
      .unwrap()
      .get_model()
      .unwrap()
      .set_value(&query);
    self.sql.update(|prev| {
      *prev = query;
    });
    ()
  }
}
