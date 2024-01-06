use std::collections::BTreeMap;

use common::{
  enums::{Project, ProjectConnectionStatus},
  utils::project_matcher,
};
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

  pub fn set_projects(
    &self,
    projects: Vec<(String, Project)>,
  ) -> Result<BTreeMap<String, Project>> {
    let projects = projects
      .into_iter()
      .map(|(_, project)| project_matcher(project))
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

  pub fn create_project_connection_string(&self, project_name: &str) -> String {
    let projects = self.0.get_untracked();
    let (_, project) = projects.get_key_value(project_name).unwrap();

    match project {
      Project::POSTGRESQL(project) => {
        let driver = project.driver.clone();
        format!(
          "user={} password={} host={} port={}",
          driver.user, driver.password, driver.host, driver.port,
        )
      }
    }
  }

  pub async fn connect(&self, project_name: &str) -> Result<Vec<String>> {
    let projects = self.0;
    let _projects = projects.get_untracked();
    let project = _projects.get(project_name).unwrap();

    match project {
      Project::POSTGRESQL(project) => {
        if project.connection_status == ProjectConnectionStatus::Connected {
          return Ok(project.schemas.clone().unwrap());
        }
        let schemas = self.postgresql_schema_selector(&project.name).await?;
        projects.update(|prev| {
          let project = prev.get_mut(project_name).unwrap();
          match project {
            Project::POSTGRESQL(project) => {
              project.schemas = Some(schemas.clone());
              project.connection_status = ProjectConnectionStatus::Connected;
            }
          }
        });
        Ok(schemas)
      }
    }
  }

  pub async fn retrieve_tables(
    &self,
    project_name: &str,
    schema: &str,
  ) -> Result<Vec<(String, String)>> {
    let projects = self.0;
    let _projects = projects.get_untracked();
    let project = _projects.get(project_name).unwrap();

    match project {
      Project::POSTGRESQL(project) => {
        if let Some(tables) = &project.tables {
          let tables = tables.get(schema).unwrap();
          if !tables.is_empty() {
            return Ok(tables.clone());
          }
        }

        let tables = self
          .postgresql_table_selector(&project.name, schema)
          .await
          .unwrap();

        projects.update(|prev| {
          let project = prev.get_mut(project_name).unwrap();
          match project {
            Project::POSTGRESQL(project) => {
              let _tables = project.tables.get_or_insert_with(BTreeMap::new);
              _tables.insert(schema.to_string(), tables.clone());
              project.tables = Some(_tables.clone());
            }
          }
        });

        Ok(tables)
      }
    }
  }

  pub async fn delete_project(&self, project_name: &str) -> Result<()> {
    let args = serde_wasm_bindgen::to_value(&InvokeDeleteProjectArgs { project_name }).unwrap();
    invoke(&Invoke::delete_project.to_string(), args).await;
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project_name);
    });
    Ok(())
  }

  async fn postgresql_schema_selector(&self, project_name: &str) -> Result<Vec<String>> {
    let connection_string = self.create_project_connection_string(project_name);
    let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
      project_name,
      key: &connection_string,
    })
    .unwrap();
    let schemas = invoke(&Invoke::postgresql_connector.to_string(), args).await;
    let mut schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
    schemas.sort();
    Ok(schemas)
  }

  async fn postgresql_table_selector(
    &self,
    project_name: &str,
    schema: &str,
  ) -> Result<Vec<(String, String)>> {
    let args = serde_wasm_bindgen::to_value(&InvokeSchemaTablesArgs {
      project_name,
      schema,
    })
    .unwrap();
    let tables = invoke(&Invoke::select_schema_tables.to_string(), args).await;
    let tables = serde_wasm_bindgen::from_value::<Vec<(String, String)>>(tables).unwrap();
    Ok(tables)
  }
}
