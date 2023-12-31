use std::{borrow::Borrow, collections::BTreeMap};

use common::project::ProjectDetails;
use leptos::{create_rw_signal, error::Result, RwSignal, SignalGetUntracked, SignalUpdate};

use crate::{
  invoke::{Invoke, InvokePostgresConnectionArgs, InvokeTablesArgs},
  wasm_functions::invoke,
};

#[derive(Clone, Debug)]
pub struct Project {
  pub host: String,
  pub port: String,
  pub user: String,
  pub password: String,
  pub schemas: Vec<String>,
  pub tables: Vec<(String, String)>,
}

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(pub RwSignal<BTreeMap<String, (Project, bool)>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub fn set_projects(&self, projects: Vec<ProjectDetails>) -> Result<()> {
    let projects = projects
      .into_iter()
      .map(|project| {
        (
          project.name,
          (
            Project {
              host: project.host,
              port: project.port,
              user: project.user,
              password: project.password,
              schemas: Vec::new(),
              tables: Vec::new(),
            },
            false,
          ),
        )
      })
      .collect::<BTreeMap<String, (Project, bool)>>();
    self.0.update(|prev| {
      *prev = projects;
    });
    Ok(())
  }

  pub fn create_project_connection_string(&self, project_key: &str) -> String {
    let projects = self.0.get_untracked();
    let (_, project) = projects.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.0.user, project.0.password, project.0.host, project.0.port,
    )
  }

  pub async fn connect(&self, project_name: &str) -> Result<Vec<String>> {
    let projects = self.0;
    let connection_string = self.create_project_connection_string(project_name);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project_name.to_string(),
      key: connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::pg_connector.to_string(), args).await;
    let mut schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    schemas.sort();
    let schemas_clone: Vec<String> = schemas.clone();
    projects.update(|prev| {
      let project = prev.get_mut(project_name).unwrap();
      project.0.schemas = schemas_clone;
    });
    Ok(schemas)
  }

  pub async fn retrieve_tables(&self, project_name: &str, schema: &str) -> Result<()> {
    let projects = self.0;
    let project = projects.borrow().get_untracked();
    let project = project.get(project_name).unwrap();
    if !project.0.tables.is_empty() {
      return Ok(());
    }
    let args = serde_wasm_bindgen::to_value(&InvokeTablesArgs {
      schema: schema.to_string(),
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let tables = serde_wasm_bindgen::from_value::<Vec<(String, String)>>(tables).unwrap();
    projects.update(|prev| {
      let project = prev.get_mut(project_name).unwrap();
      project.0.tables = tables;
    });
    Ok(())
  }

  pub async fn delete_project(&self, project_name: &str) -> Result<()> {
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project_name);
    });
    Ok(())
  }
}
