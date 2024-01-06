use std::{borrow::Borrow, collections::BTreeMap};

use common::{enums::Project, utils::project_matcher};
use leptos::{
  create_rw_signal, error::Result, RwSignal, SignalGet, SignalGetUntracked, SignalUpdate,
};

use crate::{
  invoke::{Invoke, InvokeDeleteProjectArgs, InvokePostgresConnectionArgs, InvokeSchemaTablesArgs},
  wasm_functions::invoke,
};

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

  pub fn set_projects(&self, projects: Vec<Project>) -> Result<BTreeMap<String, Project>> {
    let projects = projects
      .into_iter()
      .map(|project| project_matcher(project))
      .collect::<BTreeMap<String, Project>>();
    self.0.update(|prev| {
      *prev = projects;
    });
    Ok(self.0.get_untracked().clone())
  }

  pub fn insert_project(&self, project: Project) -> Result<()> {
    self.0.update(|prev| {
      let project = match project {
        Project::POSTGRESQL(project) => (project.name.clone(), Project::POSTGRESQL(project)),
        _ => unreachable!(),
      };
      prev.insert(project.0, project.1);
    });
    Ok(())
  }

  pub fn get_projects(&self) -> Result<Vec<String>> {
    let projects = self.0.get();
    let projects = projects.keys().cloned().collect::<Vec<String>>();
    Ok(projects)
  }

  pub fn create_project_connection_string(&self, project_key: &str) -> String {
    let projects = self.0.get_untracked();
    let (_, project) = projects.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.user, project.password, project.host, project.port,
    )
  }

  pub async fn connect(&self, project: &str) -> Result<Vec<String>> {
    let projects = self.0;

    if let Some(project) = projects.get_untracked().get(project) {
      if !project.schemas.is_empty() {
        return Ok(project.schemas.clone());
      }
    }

    let connection_string = self.create_project_connection_string(project);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project: project.to_string(),
      key: connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::postgresql_connector.to_string(), args).await;
    let mut schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    schemas.sort();
    projects.update(|prev| {
      let project = prev.get_mut(project).unwrap();
      project.schemas = schemas;
      project.status = ProjectConnectionStatus::Connected;
    });
    let schemas = self.0.get_untracked().get(project).unwrap().schemas.clone();
    Ok(schemas)
  }

  pub async fn retrieve_tables(
    &self,
    project: &str,
    schema: &str,
  ) -> Result<Vec<(String, String)>> {
    let projects = self.0;
    let p = projects.borrow().get_untracked();
    let p = p.get(project).unwrap();
    if let Some(tables) = p.tables.get(schema) {
      if !tables.is_empty() {
        return Ok(tables.clone());
      }
    }
    let args = serde_wasm_bindgen::to_value(&InvokeSchemaTablesArgs {
      project: project.to_string(),
      schema: schema.to_string(),
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let tables = serde_wasm_bindgen::from_value::<Vec<(String, String)>>(tables).unwrap();
    projects.update(|prev| {
      let project = prev.get_mut(project).unwrap();
      project.tables.insert(schema.to_string(), tables.clone());
    });
    let tables = self
      .0
      .get_untracked()
      .get(project)
      .unwrap()
      .tables
      .get(schema)
      .unwrap()
      .clone();
    Ok(tables)
  }

  pub async fn delete_project(&self, project: &str) -> Result<()> {
    let args = serde_wasm_bindgen::to_value(&InvokeDeleteProjectArgs {
      project: project.to_string(),
    })
    .unwrap();
    invoke(&Invoke::delete_project.to_string(), args).await;
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project);
    });
    Ok(())
  }
}
