use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::{drivers::postgresql::Postgresql as PostgresqlDriver, enums::ProjectConnectionStatus};

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Postgresql {
  pub name: String,
  pub driver: PostgresqlDriver,
  pub schmeas: Vec<String>,
  pub tables: BTreeMap<String, Vec<(String, String)>>,
  pub connection_status: ProjectConnectionStatus,
}
