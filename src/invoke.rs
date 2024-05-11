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
pub struct InvokePostgresConnectorArgs<'a> {
  pub project_id: &'a str,
  pub key: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokePostgresSchemasArgs<'a> {
  pub project_id: &'a str,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeSchemaRelationsArgs<'a> {
  pub project_name: &'a str,
  pub schema: &'a str,
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
  //pub project: Project,
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

#[derive(Default, Serialize, Deserialize)]
pub struct InvokeContextMenuArgs<'a> {
  pub pos: Option<InvokeContextMenuPosition>,
  #[serde(borrow)]
  pub items: Option<Vec<InvokeContextMenuItem<'a>>>,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeContextMenuItem<'a> {
  pub label: Option<&'a str>,
  pub disabled: Option<bool>,
  pub shortcut: Option<&'a str>,
  pub event: Option<&'a str>,
  pub payload: Option<&'a str>,
  pub subitems: Option<Vec<InvokeContextMenuItem<'a>>>,
  pub icon: Option<InvokeContextItemIcon<'a>>,
  pub checked: Option<bool>,
  pub is_separator: Option<bool>,
}

impl<'a> Default for InvokeContextMenuItem<'a> {
  fn default() -> Self {
    Self {
      label: None,
      disabled: Some(false),
      shortcut: None,
      event: None,
      payload: None,
      subitems: None,
      icon: None,
      checked: Some(false),
      is_separator: Some(false),
    }
  }
}

#[derive(Serialize, Deserialize)]
pub struct InvokeContextItemIcon<'a> {
  pub path: &'a str,
  pub width: Option<u32>,
  pub height: Option<u32>,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeContextMenuPosition {
  pub x: f64,
  pub y: f64,
  pub is_absolute: Option<bool>,
}

