use std::fmt::Display;

use serde::{Deserialize, Serialize};

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

impl AsRef<str> for Drivers {
  fn as_ref(&self) -> &str {
    match self {
      Drivers::POSTGRESQL => "POSTGRESQL",
    }
  }
}

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize)]
pub enum ProjectConnectionStatus {
  Connected,
  Connecting,
  #[default]
  Disconnected,
  Failed,
}

impl std::error::Error for ProjectConnectionStatus {}
impl Display for ProjectConnectionStatus {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      ProjectConnectionStatus::Connected => write!(f, "Connected"),
      ProjectConnectionStatus::Connecting => write!(f, "Connecting"),
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

