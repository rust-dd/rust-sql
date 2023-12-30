use std::{
  borrow::BorrowMut,
  collections::{BTreeMap, HashMap},
};

use leptos::{create_rw_signal, RwSignal, SignalGet, SignalGetUntracked};

use crate::{
  invoke::{Invoke, InvokePostgresConnectionArgs},
  wasm_functions::invoke,
};

use super::db::DBStore;

#[derive(Clone, Copy, Debug, Default)]
pub enum ProjectStatus {
  Connected,
  Connecting,
  #[default]
  Disconnected,
}

#[derive(Clone, Debug)]
pub struct Project {
  host: String,
  port: String,
  user: String,
  password: String,
  schemas: Vec<String>,
  tables: Vec<(String, String)>,
  status: ProjectStatus,
}

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(RwSignal<BTreeMap<String, Project>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub fn create_project_connection_string(&self, project_key: &str) -> String {
    let project = self.0.get_untracked();
    let (_, project) = project.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.user, project.password, project.host, project.port,
    )
  }

  pub async fn connect(&mut self, project_key: &str) {
    let mut project = self.0.get_untracked();
    let project = project.get_mut(project_key).unwrap();
    project.status = ProjectStatus::Connecting;
    let connection_string = self.create_project_connection_string(project_key);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project_key.to_string(),
      key: connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::pg_connector.to_string(), args).await;
    let schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    project.schemas = schemas;
    project.status = ProjectStatus::Connected;
  }
}
