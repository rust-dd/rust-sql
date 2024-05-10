use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize)]
pub struct Postgresql {
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}

impl Postgresql {
  pub fn new(user: String, password: String, host: String, port: String) -> Self {
    Self {
      user,
      password,
      host,
      port,
    }
  }
}

