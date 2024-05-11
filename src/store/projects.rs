use std::collections::BTreeMap;

use leptos::{
  create_rw_signal, logging::log, use_context, RwSignal, SignalGet, SignalSet, SignalUpdate,
};
use tauri_sys::tauri::invoke;

use crate::invoke::Invoke;

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(pub RwSignal<BTreeMap<String, String>>);

impl Default for ProjectsStore {
  fn default() -> Self {
    Self::new()
  }
}

impl ProjectsStore {
  #[must_use]
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::default()))
  }

  pub async fn load_projects(&self) {
    let projects_store = use_context::<ProjectsStore>().unwrap();
    let projects = invoke::<_, BTreeMap<String, String>>(Invoke::ProjectDbSelect.as_ref(), &())
      .await
      .unwrap();
    log!("projects: {:?}", projects);
    projects_store.0.set(projects);
  }

  pub fn select_project_by_name(&self, project_id: &str) -> Option<String> {
    self.0.get().get(project_id).cloned()
  }

  pub fn delete_project(&self, project_id: &str) {
    self.0.update(|projects| {
      projects.remove(project_id);
    });
  }
}

