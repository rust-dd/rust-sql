use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct ProjectDetails {
  pub name: String,
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}
