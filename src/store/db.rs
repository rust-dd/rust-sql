use crate::{
  invoke::{Invoke, InvokePostgresConnectionArgs, InvokeRemoveProjectArgs, InvokeTablesArgs},
  wasm_functions::invoke,
};
use leptos::{create_rw_signal, RwSignal, SignalGetUntracked, SignalSet, SignalUpdate};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug)]
pub struct DBStore {
  pub project: RwSignal<String>,
  pub db_host: RwSignal<String>,
  pub db_port: RwSignal<String>,
  pub db_user: RwSignal<String>,
  pub db_password: RwSignal<String>,
  pub schemas: RwSignal<HashMap<String, bool>>,
  pub is_connecting: RwSignal<bool>,
  pub tables: RwSignal<HashMap<String, Vec<(String, bool)>>>,
}

impl Default for DBStore {
  fn default() -> Self {
    Self::new(None, None, None, None, None)
  }
}

impl DBStore {
  pub fn new(
    project: Option<String>,
    db_host: Option<String>,
    db_post: Option<String>,
    db_user: Option<String>,
    db_password: Option<String>,
  ) -> Self {
    Self {
      project: create_rw_signal(project.unwrap_or_default()),
      db_host: create_rw_signal(db_host.unwrap_or_default()),
      db_port: create_rw_signal(db_post.unwrap_or_default()),
      db_user: create_rw_signal(db_user.unwrap_or_default()),
      db_password: create_rw_signal(db_password.unwrap_or_default()),
      schemas: create_rw_signal(HashMap::new()),
      is_connecting: create_rw_signal(false),
      tables: create_rw_signal(HashMap::new()),
    }
  }

  pub fn reset(&mut self) {
    self.project.set(String::new());
    self.db_host.set(String::new());
    self.db_port.set(String::new());
    self.db_user.set(String::new());
    self.db_password.set(String::new());
    self.is_connecting.set(false);
  }

  pub fn create_connection_string(&self) -> String {
    format!(
      "user={} password={} host={} port={}",
      self.db_user.get_untracked(),
      self.db_password.get_untracked(),
      self.db_host.get_untracked(),
      self.db_port.get_untracked(),
    )
  }

  pub async fn connect(&mut self) {
    self.is_connecting.set(true);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: self.project.get_untracked(),
      key: self.create_connection_string(),
    })
    .unwrap();
    let schemas = invoke(&Invoke::pg_connector.to_string(), args).await;
    let schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    for schema in schemas {
      self.schemas.update(|prev| {
        prev.insert(schema.clone(), false);
      });
    }
    self.is_connecting.set(false);
  }

  pub async fn select_tables(&mut self, schema: String) -> Result<Vec<(String, bool)>, ()> {
    if let Some(tables) = self.tables.get_untracked().get(&schema) {
      if !tables.is_empty() {
        return Ok(tables.clone());
      }
    }

    let args = serde_wasm_bindgen::to_value(&InvokeTablesArgs {
      schema: schema.to_string(),
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let mut tables = serde_wasm_bindgen::from_value::<Vec<String>>(tables).unwrap();
    tables.sort();
    let tables = tables
      .into_iter()
      .map(|t| (t, false))
      .collect::<Vec<(String, bool)>>();
    self.tables.update(|prev| {
      prev.insert(schema, tables.clone());
    });
    Ok(tables)
  }

  pub async fn select_project_details(&mut self, project: String) -> Result<(), ()> {
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project.clone(),
      key: String::new(),
    })
    .unwrap();
    let project_details = invoke(&Invoke::select_project_details.to_string(), args).await;
    let project_details =
      serde_wasm_bindgen::from_value::<HashMap<String, String>>(project_details).unwrap();
    self.project.set(project);
    self
      .db_user
      .set(project_details.get("user").unwrap().to_string());
    self
      .db_password
      .set(project_details.get("password").unwrap().to_string());
    self
      .db_host
      .set(project_details.get("host").unwrap().to_string());
    self
      .db_port
      .set(project_details.get("port").unwrap().to_string());
    Ok(())
  }

  pub async fn delete_project(&mut self, project: String) -> Result<(), ()> {
    let args = serde_wasm_bindgen::to_value(&InvokeRemoveProjectArgs { project }).unwrap();
    invoke(&Invoke::delete_project.to_string(), args).await;
    Ok(())
  }
}

