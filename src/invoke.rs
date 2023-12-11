use std::fmt::Display;

use serde::{Deserialize, Serialize};

#[allow(non_camel_case_types)]
pub enum Invoke {
  delete_project,
  pg_connector,
  select_projects,
  select_project_details,
  select_schema_tables,
  select_sql_result,
}

impl Display for Invoke {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Invoke::delete_project => write!(f, "delete_project"),
      Invoke::pg_connector => write!(f, "pg_connector"),
      Invoke::select_projects => write!(f, "select_projects"),
      Invoke::select_project_details => write!(f, "select_project_details"),
      Invoke::select_schema_tables => write!(f, "select_schema_tables"),
      Invoke::select_sql_result => write!(f, "select_sql_result"),
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
