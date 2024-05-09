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
  Failed,
}

impl std::error::Error for ProjectConnectionStatus {}
impl Display for ProjectConnectionStatus {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      ProjectConnectionStatus::Connected => write!(f, "Connected"),
      ProjectConnectionStatus::Disconnected => write!(f, "Disconnected"),
      ProjectConnectionStatus::Failed => write!(f, "Failed"),
    }
  }
}

use std::fmt;

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub enum PostgresqlError {
  ConnectionTimeout,
  ConnectionError,
  QueryTimeout,
  QueryError,
}

impl std::error::Error for PostgresqlError {}
impl fmt::Display for PostgresqlError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      &PostgresqlError::ConnectionTimeout => write!(f, "ConnectionTimeout"),
      &PostgresqlError::ConnectionError => write!(f, "ConnectionError"),
      &PostgresqlError::QueryTimeout => write!(f, "QueryTimeout"),
      &PostgresqlError::QueryError => write!(f, "QueryError"),
    }
  }
}

