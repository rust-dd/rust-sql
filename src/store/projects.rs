use std::collections::BTreeMap;

use leptos::{RwSignal, SignalGet, SignalSet};
use tauri_sys::tauri::invoke;

use crate::invoke::{Invoke, InvokeProjectDbDeleteArgs, InvokeProjectDbInsertArgs};

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
    Self(RwSignal::default())
  }

  pub fn select_project_by_name(&self, project_id: &str) -> Option<String> {
    self.0.get().get(project_id).cloned()
  }

  pub async fn load_projects(&self) {
    let projects = invoke::<_, BTreeMap<String, String>>(Invoke::ProjectDbSelect.as_ref(), &())
      .await
      .unwrap();
    self.0.set(projects);
  }

  pub async fn insert_project(&self, project_id: &str, project_details: &str) {
    let _ = invoke::<_, ()>(
      Invoke::ProjectDbInsert.as_ref(),
      &InvokeProjectDbInsertArgs {
        project_id,
        project_details,
      },
    )
    .await;
    self.load_projects().await;
  }

  pub async fn delete_project(&self, project_id: &str) {
    let _ = invoke::<_, ()>(
      Invoke::ProjectDbDelete.as_ref(),
      &InvokeProjectDbDeleteArgs { project_id },
    )
    .await;
    self.load_projects().await;
  }
}

