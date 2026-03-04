use std::fmt;
use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Clone, Copy, Serialize, Deserialize, Default)]
pub enum Drivers {
  #[default]
  PGSQL,
  REDSHIFT,
}

impl fmt::Display for Drivers {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Drivers::PGSQL => write!(f, "PGSQL"),
      Drivers::REDSHIFT => write!(f, "REDSHIFT"),
    }
  }
}

impl AsRef<str> for Drivers {
  fn as_ref(&self) -> &str {
    match self {
      Drivers::PGSQL => "PGSQL",
      Drivers::REDSHIFT => "REDSHIFT",
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
impl fmt::Display for ProjectConnectionStatus {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      ProjectConnectionStatus::Connected => write!(f, "Connected"),
      ProjectConnectionStatus::Connecting => write!(f, "Connecting"),
      ProjectConnectionStatus::Disconnected => write!(f, "Disconnected"),
      ProjectConnectionStatus::Failed => write!(f, "Failed"),
    }
  }
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
  #[error("Connection timed out")]
  ConnectionTimeout,
  #[error("Connection failed: {0}")]
  ConnectionFailed(String),
  #[error("Query timed out")]
  QueryTimeout,
  #[error("Query failed: {0}")]
  QueryFailed(String),
  #[error("Project not found: {0}")]
  ProjectNotFound(String),
  #[error("Client not connected: {0}")]
  ClientNotConnected(String),
  #[error("Database error: {0}")]
  DatabaseError(String),
  #[error("Serialization error: {0}")]
  SerializationError(String),
}

impl From<AppError> for tauri::Error {
  fn from(e: AppError) -> Self {
    tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
  }
}
