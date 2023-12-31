use std::{borrow::Borrow, collections::BTreeMap};

use common::project::ProjectDetails;
use leptos::{create_rw_signal, error::Result, RwSignal, SignalGetUntracked, SignalUpdate};
use serde::{Deserialize, Serialize};

use crate::{
  invoke::{Invoke, InvokeDeleteProjectArgs, InvokePostgresConnectionArgs, InvokeSchemaTablesArgs},
  wasm_functions::invoke,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Project {
  pub host: String,
  pub port: String,
  pub user: String,
  pub password: String,
  pub schemas: Vec<String>,
  pub tables: BTreeMap<String, Vec<(String, String)>>,
}

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(pub RwSignal<BTreeMap<String, Project>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub fn set_projects(&self, projects: Vec<ProjectDetails>) -> Result<BTreeMap<String, Project>> {
    let projects = projects
      .into_iter()
      .map(|project| {
        (
          project.name,
          Project {
            host: project.host,
            port: project.port,
            user: project.user,
            password: project.password,
            schemas: Vec::new(),
            tables: BTreeMap::new(),
          },
        )
      })
      .collect::<BTreeMap<String, Project>>();
    self.0.update(|prev| {
      *prev = projects;
    });
    Ok(self.0.get_untracked().clone())
  }

  pub fn create_project_connection_string(&self, project_key: &str) -> String {
    let projects = self.0.get_untracked();
    let (_, project) = projects.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.user, project.password, project.host, project.port,
    )
  }

  pub async fn connect(&self, project_name: &str) -> Result<Vec<String>> {
    let projects = self.0;

    if let Some(project) = projects.get_untracked().get(project_name) {
      if !project.schemas.is_empty() {
        return Ok(project.schemas.clone());
      }
    }

    let connection_string = self.create_project_connection_string(project_name);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project_name.to_string(),
      key: connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::pg_connector.to_string(), args).await;
    let mut schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    schemas.sort();
    projects.update(|prev| {
      let project = prev.get_mut(project_name).unwrap();
      project.schemas = schemas;
    });
    let schemas = self
      .0
      .get_untracked()
      .get(project_name)
      .unwrap()
      .schemas
      .clone();
    Ok(schemas)
  }

  pub async fn retrieve_tables(
    &self,
    project_name: &str,
    schema: &str,
  ) -> Result<Vec<(String, String)>> {
    let projects = self.0;
    let project = projects.borrow().get_untracked();
    let project = project.get(project_name).unwrap();
    if let Some(tables) = project.tables.get(schema) {
      if !tables.is_empty() {
        return Ok(tables.clone());
      }
    }
    let args = serde_wasm_bindgen::to_value(&InvokeSchemaTablesArgs {
      project: project_name.to_string(),
      schema: schema.to_string(),
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let tables = serde_wasm_bindgen::from_value::<Vec<(String, String)>>(tables).unwrap();
    projects.update(|prev| {
      let project = prev.get_mut(project_name).unwrap();
      project.tables.insert(schema.to_string(), tables.clone());
    });
    let tables = self
      .0
      .get_untracked()
      .get(project_name)
      .unwrap()
      .tables
      .get(schema)
      .unwrap()
      .clone();
    Ok(tables)
  }

  pub async fn delete_project(&self, project_name: &str) -> Result<()> {
    let args = serde_wasm_bindgen::to_value(&InvokeDeleteProjectArgs {
      project: project_name.to_string(),
    })
    .unwrap();
    invoke(&Invoke::delete_project.to_string(), args).await;
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project_name);
    });
    Ok(())
  }
}
