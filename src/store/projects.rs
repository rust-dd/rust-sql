use std::{
  collections::BTreeMap,
  ops::{Deref, DerefMut},
};

use common::{enums::Drivers, types::BTreeVecStore};
use leptos::{RwSignal, SignalGet, SignalSet};
use tauri_sys::tauri::invoke;

use crate::invoke::{Invoke, InvokeProjectDbDeleteArgs, InvokeProjectDbInsertArgs};

#[derive(Clone, Copy, Debug)]
pub struct ProjectsStore(pub RwSignal<BTreeVecStore>);

impl Deref for ProjectsStore {
  type Target = RwSignal<BTreeVecStore>;

  fn deref(&self) -> &Self::Target {
    &self.0
  }
}

impl DerefMut for ProjectsStore {
  fn deref_mut(&mut self) -> &mut Self::Target {
    &mut self.0
  }
}

impl ProjectsStore {
  #[must_use]
  pub fn new() -> Self {
    Self(RwSignal::default())
  }

  pub fn select_project_by_name(&self, project_id: &str) -> Option<Vec<String>> {
    self.get().get(project_id).cloned()
  }

  pub fn select_driver_by_project(&self, project_id: Option<&str>) -> Drivers {
    if project_id.is_none() {
      return Drivers::PGSQL;
    }

    let project = self.select_project_by_name(project_id.unwrap()).unwrap();
    let driver = project.first().unwrap();

    match driver.as_str() {
      "PGSQL" => Drivers::PGSQL,
      _ => unreachable!(),
    }
  }

  pub async fn load_projects(&self) {
    let projects =
      invoke::<_, BTreeMap<String, Vec<String>>>(Invoke::ProjectDbSelect.as_ref(), &())
        .await
        .unwrap();
    self.set(projects);
  }

  pub async fn insert_project(&self, project_id: &str, project_details: Vec<String>) {
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

