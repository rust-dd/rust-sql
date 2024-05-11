use std::collections::BTreeMap;

use common::{
  enums::{PostgresqlError, Project, ProjectConnectionStatus},
  projects::postgresql::PostgresqlRelation,
};
use leptos::{
  create_rw_signal, error::Result, logging::log, use_context, RwSignal, SignalGet, SignalUpdate,
};
use tauri_sys::tauri::invoke;

use crate::{
  app::ErrorModal,
  invoke::{
    Invoke, InvokeDeleteProjectArgs, InvokePostgresConnectorArgs, InvokeSchemaRelationsArgs,
    InvokeSchemaTablesArgs,
  },
};

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(pub RwSignal<BTreeMap<String, Project>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  #[must_use]
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub fn set_projects(
    &self,
    projects: Vec<(String, Project)>,
  ) -> Result<BTreeMap<String, Project>> {
    self.0.update(|prev| {
      // insert only if project does not exist
      for (name, project) in projects.iter() {
        if !prev.contains_key(name) {
          prev.insert(name.clone(), project.clone());
        }
      }
    });
    Ok(self.0.get().clone())
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
    let projects = self.0.get();
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

  // pub async fn connector(&self, project_name: &str) -> Result<()> {
  //   let projects = self.0;
  //   let _projects = projects.get();
  //   let key = self.create_project_connection_string(project_name);
  //   let status = invoke::<_, ProjectConnectionStatus>(
  //     Invoke::pgsql_connector.as_ref(),
  //     &InvokePostgresConnectorArgs {
  //       project_name,
  //       key: &key,
  //     },
  //   )
  //   .await?;

  //   match status {
  //     ProjectConnectionStatus::Connected => todo!(),
  //     ProjectConnectionStatus::Failed => todo!(),
  //     ProjectConnectionStatus::Disconnected => todo!(),
  //   }
  // }

  pub async fn retrieve_tables(
    &self,
    project_name: &str,
    schema: &str,
  ) -> Result<Vec<(String, String)>> {
    let projects = self.0;
    let _projects = projects.get();
    let project = _projects.get(project_name).unwrap();

    match project {
      Project::POSTGRESQL(project) => {
        if let Some(tables) = &project.tables {
          if let Some(tables) = tables.get(schema) {
            return Ok(tables.clone());
          }
        }

        let (tables, relations) = self
          .postgresql_table_selector(&project.name, schema)
          .await
          .unwrap();

        projects.update(|prev| {
          let project = prev.get_mut(project_name).unwrap();
          match project {
            Project::POSTGRESQL(project) => {
              project
                .tables
                .as_mut()
                .unwrap_or(&mut BTreeMap::<String, Vec<(String, String)>>::new())
                .insert(schema.to_string(), tables.clone());
              project.relations = Some(relations.clone());
            }
          }
        });

        Ok(tables)
      }
    }
  }

  pub async fn delete_project(&self, project_name: &str) -> Result<()> {
    invoke(
      &Invoke::delete_project.to_string(),
      &InvokeDeleteProjectArgs { project_name },
    )
    .await?;
    let projects = self.0;
    projects.update(|prev| {
      prev.remove(project_name);
    });
    Ok(())
  }

  // async fn postgresql_schema_selector(&self, project_name: &str) -> Result<Vec<String>> {
  //   let connection_string = self.create_project_connection_string(project_name);
  //   let schemas = invoke::<_, Vec<String>>(
  //     &Invoke::pgsql_connector.to_string(),
  //     &InvokePostgresConnectionArgs {
  //       project_name,
  //       key: &connection_string,
  //     },
  //   )
  //   .await
  //   .map_err(|err| match err {
  //     tauri_sys::Error::Command(command) => {
  //       if command.contains("ConnectionTimeout") {
  //         PostgresqlError::ConnectionTimeout
  //       } else if command.contains("ConnectionError") {
  //         PostgresqlError::ConnectionError
  //       } else if command.contains("QueryError") {
  //         PostgresqlError::QueryError
  //       } else if command.contains("QueryTimeout") {
  //         PostgresqlError::QueryTimeout
  //       } else {
  //         PostgresqlError::ConnectionError
  //       }
  //     }
  //     _ => PostgresqlError::ConnectionError,
  //   });

  //   if schemas.is_err() {
  //     let mut error_modal = use_context::<ErrorModal>().unwrap();
  //     log!("err");
  //     let error_message = schemas.clone().unwrap_err().to_string();
  //     error_modal.show.update(|prev| *prev = true);
  //     error_modal.message = error_message;
  //     return Err(schemas.unwrap_err().into());
  //   }

  //   let mut schemas = schemas.unwrap();
  //   schemas.sort();
  //   Ok(schemas)
  // }

  async fn postgresql_table_selector(
    &self,
    project_name: &str,
    schema: &str,
  ) -> Result<(Vec<(String, String)>, Vec<PostgresqlRelation>)> {
    let tables = invoke::<_, Vec<(String, String)>>(
      &Invoke::pgsql_load_tables.to_string(),
      &InvokeSchemaTablesArgs {
        project_name,
        schema,
      },
    )
    .await?;

    let relations = invoke::<_, Vec<PostgresqlRelation>>(
      &Invoke::pgsql_load_relations.to_string(),
      &InvokeSchemaRelationsArgs {
        project_name,
        schema,
      },
    )
    .await?;

    Ok((tables, relations))
  }
}

