use std::collections::{BTreeMap, HashMap};

use leptos::{create_rw_signal, RwSignal, SignalGet, SignalGetUntracked};

use super::db::DBStore;

#[derive(Clone, Copy, Debug, Default)]
pub enum ProjectStatus {
  Connected,
  Connecting,
  #[default]
  Disconnected,
}

#[derive(Clone, Debug)]
pub struct Project {
  host: String,
  port: String,
  user: String,
  password: String,
  schemas: Vec<String>,
  tables: Vec<(String, String)>,
  status: ProjectStatus,
}

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(RwSignal<BTreeMap<String, Project>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub fn create_project_connection_string(&self, project_key: &str) -> String {
    let project = self.0.get_untracked();
    let (_, project) = project.get_key_value(project_key).unwrap();

    format!(
      "user={} password={} host={} port={}",
      project.user, project.password, project.host, project.port,
    )
  }

  pub async fn connect(&self) {}
}
