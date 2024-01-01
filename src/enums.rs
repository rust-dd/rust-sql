use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueryTableLayout {
  Grid,
  Records,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum ProjectConnectionStatus {
  Connected,
  #[default]
  Disconnected,
}
