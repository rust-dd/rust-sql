use std::fmt::Display;

use serde::{Deserialize, Serialize};

use super::projects::postgresql::Postgresql;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Project {
  POSTGRESQL(Postgresql),
}

#[derive(Clone, Serialize, Deserialize)]
pub enum Drivers {
  POSTGRESQL,
}

impl Display for Drivers {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Drivers::POSTGRESQL => write!(f, "POSTGRESQL"),
    }
  }
}

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize)]
pub enum ProjectConnectionStatus {
  Connected,
  #[default]
  Disconnected,
}
