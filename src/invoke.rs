use std::fmt::Display;

use serde::{Deserialize, Serialize};

#[allow(non_camel_case_types)]
pub enum Invoke {
  delete_project,
  delete_query,
  insert_query,
  pg_connector,
  select_projects,
  select_project_details,
  select_queries,
  select_schema_tables,
  select_sql_result,
}

impl Display for Invoke {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Invoke::delete_project => write!(f, "delete_project"),
      Invoke::delete_query => write!(f, "delete_query"),
      Invoke::insert_query => write!(f, "insert_query"),
      Invoke::pg_connector => write!(f, "pg_connector"),
      Invoke::select_projects => write!(f, "select_projects"),
      Invoke::select_project_details => write!(f, "select_project_details"),
      Invoke::select_queries => write!(f, "select_queries"),
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
pub struct InvokeDeleteProjectArgs {
  pub project: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeInsertQueryArgs {
  pub key: String,
  pub sql: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSelectQueriesArgs;

#[derive(Serialize, Deserialize)]
pub struct InvokeDeleteQueryArgs {
  pub key: String,
}
