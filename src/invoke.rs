use std::fmt::Display;

use serde::{Deserialize, Serialize};

pub enum Invoke {
  ProjectDbSelect,
  ProjectDbInsert,
  ProjectDbDelete,

  QueryDbSelect,
  QueryDbInsert,
  QueryDbDelete,

  PgsqlConnector,
  PgsqlLoadSchemas,
  PgsqlLoadTables,
  PgsqlLoadRelations,
  PgsqlRunQuery,
}

impl Display for Invoke {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Invoke::ProjectDbSelect => write!(f, "project_db_select"),
      Invoke::ProjectDbInsert => write!(f, "project_db_insert"),
      Invoke::ProjectDbDelete => write!(f, "project_db_delete"),

      Invoke::QueryDbSelect => write!(f, "query_db_select"),
      Invoke::QueryDbInsert => write!(f, "query_db_insert"),
      Invoke::QueryDbDelete => write!(f, "query_db_delete"),

      Invoke::PgsqlConnector => write!(f, "pgsql_connector"),
      Invoke::PgsqlLoadRelations => write!(f, "pgsql_load_relations"),
      Invoke::PgsqlLoadTables => write!(f, "pgsql_load_tables"),
      Invoke::PgsqlLoadSchemas => write!(f, "pgsql_load_schemas"),
      Invoke::PgsqlRunQuery => write!(f, "pgsql_run_query"),
    }
  }
}

impl AsRef<str> for Invoke {
  fn as_ref(&self) -> &str {
    match *self {
      Invoke::ProjectDbSelect => "project_db_select",
      Invoke::ProjectDbInsert => "project_db_insert",
      Invoke::ProjectDbDelete => "project_db_delete",

      Invoke::QueryDbSelect => "query_db_select",
      Invoke::QueryDbInsert => "query_db_insert",
      Invoke::QueryDbDelete => "query_db_delete",

      Invoke::PgsqlConnector => "pgsql_connector",
      Invoke::PgsqlLoadSchemas => "pgsql_load_schemas",
      Invoke::PgsqlLoadTables => "pgsql_load_tables",
      Invoke::PgsqlLoadRelations => "pgsql_load_relations",
      Invoke::PgsqlRunQuery => "pgsql_run_query",
    }
  }
}

#[derive(Serialize, Deserialize)]
pub struct InvokePgsqlConnectorArgs<'a> {
  pub project_id: &'a str,
  pub key: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokePgsqlLoadSchemasArgs<'a> {
  pub project_id: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokePgsqlLoadTablesArgs<'a> {
  pub project_id: &'a str,
  pub schema: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokePgsqlRunQueryArgs<'a> {
  pub project_id: &'a str,
  pub sql: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectDbInsertArgs<'a> {
  pub project_id: &'a str,
  pub project_details: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectDbDeleteArgs<'a> {
  pub project_id: &'a str,
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

