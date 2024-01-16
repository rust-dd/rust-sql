use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::{drivers::postgresql::Postgresql as PostgresqlDriver, enums::ProjectConnectionStatus};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Postgresql {
  pub name: String,
  pub driver: PostgresqlDriver,
  pub schemas: Option<Vec<String>>,
  pub tables: Option<BTreeMap<String, Vec<(String, String)>>>,
  pub connection_status: ProjectConnectionStatus,
  pub relations: Option<Vec<PostgresqlRelation>>,
}

impl Default for Postgresql {
  fn default() -> Self {
    Self {
      name: String::default(),
      driver: PostgresqlDriver::default(),
      schemas: None,
      tables: None,
      connection_status: ProjectConnectionStatus::Disconnected,
      relations: None,
    }
  }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PostgresqlRelation {
  pub constraint_name: String,
  pub table_name: String,
  pub column_name: String,
  pub foreign_table_name: String,
  pub foreign_column_name: String,
}
