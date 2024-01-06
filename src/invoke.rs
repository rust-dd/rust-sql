use std::fmt::Display;

use common::enums::Project;
use serde::{Deserialize, Serialize};

#[allow(non_camel_case_types)]
pub enum Invoke {
  delete_project,
  delete_query,
  insert_project,
  insert_query,
  postgresql_connector,
  select_projects,
  select_queries,
  select_schema_tables,
  select_sql_result,
}

impl Display for Invoke {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Invoke::delete_project => write!(f, "delete_project"),
      Invoke::delete_query => write!(f, "delete_query"),
      Invoke::insert_project => write!(f, "insert_project"),
      Invoke::insert_query => write!(f, "insert_query"),
      Invoke::postgresql_connector => write!(f, "postgresql_connector"),
      Invoke::select_projects => write!(f, "select_projects"),
      Invoke::select_queries => write!(f, "select_queries"),
      Invoke::select_schema_tables => write!(f, "select_schema_tables"),
      Invoke::select_sql_result => write!(f, "select_sql_result"),
    }
  }
}

#[derive(Serialize, Deserialize)]
pub struct InvokePostgresConnectionArgs<'a> {
  pub project_name: &'a str,
  pub key: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSchemaTablesArgs<'a> {
  pub project_name: &'a str,
  pub schema: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSqlResultArgs<'a> {
  pub project_name: &'a str,
  pub sql: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSelectProjectsArgs;

#[derive(Serialize, Deserialize)]
pub struct InvokeInsertProjectArgs {
  pub project: Project,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeDeleteProjectArgs<'a> {
  pub project_name: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeInsertQueryArgs<'a> {
  pub key: &'a str,
  pub sql: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSelectQueriesArgs;

#[derive(Serialize, Deserialize)]
pub struct InvokeDeleteQueryArgs<'a> {
  pub key: &'a str,
}
