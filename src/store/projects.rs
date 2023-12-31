use std::{borrow::Borrow, collections::BTreeMap};

use leptos::{create_rw_signal, error::Result, RwSignal, SignalGetUntracked, SignalUpdate};

use crate::{
  invoke::{Invoke, InvokePostgresConnectionArgs, InvokeTablesArgs},
  wasm_functions::invoke,
};

#[derive(Clone, Copy, Debug, Default)]
pub enum ProjectStatus {
  Connected,
  Connecting,
  #[default]
  Disconnected,
}

#[derive(Clone, Debug, Default)]
pub enum LoadingState {
  Loading,
  #[default]
  Loaded,
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
  loading_state: LoadingState,
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
    let projects = self.0.get_untracked();
    let (_, project) = projects.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.user, project.password, project.host, project.port,
    )
  }

  pub async fn connect(&self, project_key: &str) -> Result<()> {
    let projects = self.0;
    projects.update(|prev| {
      let project = prev.get_mut(project_key).unwrap();
      project.status = ProjectStatus::Connecting;
    });
    let connection_string = self.create_project_connection_string(project_key);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project_key.to_string(),
      key: connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::pg_connector.to_string(), args).await;
    let schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    projects.update(|prev| {
      let project = prev.get_mut(project_key).unwrap();
      project.schemas = schemas;
      project.status = ProjectStatus::Connected;
    });
    Ok(())
  }

  pub async fn retrieve_tables(&self, project_key: &str, schema: &str) -> Result<()> {
    let projects = self.0;
    projects.update(|prev| {
      let project = prev.get_mut(project_key).unwrap();
      project.loading_state = LoadingState::Loading;
    });
    let project = projects.borrow().get_untracked();
    let project = project.get(project_key).unwrap();
    if !project.tables.is_empty() {
      return Ok(());
    }
    let args = serde_wasm_bindgen::to_value(&InvokeTablesArgs {
      schema: schema.to_string(),
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let tables = serde_wasm_bindgen::from_value::<Vec<(String, String)>>(tables).unwrap();
    projects.update(|prev| {
      let project = prev.get_mut(project_key).unwrap();
      project.tables = tables;
      project.loading_state = LoadingState::Loaded;
    });
    Ok(())
  }

  pub async fn delete_project(&self, project_key: &str) -> Result<()> {
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project_key);
    });
    Ok(())
  }
}
