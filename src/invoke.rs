use std::fmt::Display;

use serde::{Deserialize, Serialize};

#[allow(non_camel_case_types)]
pub enum Invoke {
  get_projects,
  get_project_details,
  remove_project,
  get_sql_result,
  get_schema_tables,
  pg_connector,
}

impl Display for Invoke {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Invoke::get_projects => write!(f, "get_projects"),
      Invoke::get_project_details => write!(f, "get_project_details"),
      Invoke::remove_project => write!(f, "remove_project"),
      Invoke::get_sql_result => write!(f, "get_sql_result"),
      Invoke::get_schema_tables => write!(f, "get_schema_tables"),
      Invoke::pg_connector => write!(f, "pg_connector"),
    }
  }
}

#[derive(Serialize, Deserialize)]
pub struct InvokePostgresConnectionArgs {
  pub project: String,
  pub key: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeTablesArgs {
  pub schema: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeQueryArgs {
  pub sql: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectsArgs;

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectDetailsArgs {
  pub project: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeRemoveProjectArgs {
  pub project: String,
}
