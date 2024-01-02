use serde::{Deserialize, Serialize};

#[derive(Clone, Default, PartialEq, Eq, PartialOrd, Ord, Debug, Serialize, Deserialize)]
pub struct Postgresql {
  pub name: String,
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}
