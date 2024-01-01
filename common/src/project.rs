use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct ProjectDetails {
  pub name: String,
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}
