use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::{drivers::postgresql::Postgresql as PostgresqlDriver, enums::ProjectConnectionStatus};

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Postgresql {
  pub name: String,
  pub driver: PostgresqlDriver,
  pub schmemas: Option<Vec<String>>,
  pub tables: Option<BTreeMap<String, Vec<(String, String)>>>,
  pub connection_status: ProjectConnectionStatus,
}

impl Default for Postgresql {
  fn default() -> Self {
    Self {
      name: String::default(),
      driver: PostgresqlDriver::default(),
      schmemas: None,
      tables: None,
      connection_status: ProjectConnectionStatus::Disconnected,
    }
  }
}
