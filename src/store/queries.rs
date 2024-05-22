use std::{
  collections::BTreeMap,
  ops::{Deref, DerefMut},
};

use common::{enums::Drivers, types::BTreeStore};
use leptos::*;
use tauri_sys::tauri::invoke;

use crate::invoke::{Invoke, InvokeQueryDbDeleteArgs, InvokeQueryDbInsertArgs};

use super::tabs::TabsStore;

#[derive(Clone, Copy, Debug)]
pub struct QueriesStore(pub RwSignal<BTreeStore>);

impl Deref for QueriesStore {
  type Target = RwSignal<BTreeStore>;

  fn deref(&self) -> &Self::Target {
    &self.0
  }
}

impl DerefMut for QueriesStore {
  fn deref_mut(&mut self) -> &mut Self::Target {
    &mut self.0
  }
}

impl QueriesStore {
  #[must_use]
  pub fn new() -> Self {
    Self(RwSignal::default())
  }

  pub async fn load_queries(&self) {
    let saved_queries = invoke::<_, BTreeMap<String, String>>(Invoke::QueryDbSelect.as_ref(), &())
      .await
      .unwrap();
    self.update(|prev| {
      *prev = saved_queries.into_iter().collect();
    });
  }

  pub async fn insert_query(
    &self,
    project_id: &str,
    title: &str,
    driver: &Drivers,
    database: &str,
  ) {
    let tabs_store = expect_context::<TabsStore>();
    let sql = tabs_store.select_active_editor_value();
    let _ = invoke::<_, ()>(
      Invoke::QueryDbInsert.as_ref(),
      &InvokeQueryDbInsertArgs {
        query_id: &format!("{}:{}:{}:{}", project_id, database, driver, title),
        sql: &sql,
      },
    )
    .await;
    self.load_queries().await;
  }

  pub async fn delete_query(&self, query_id: &str) {
    let _ = invoke::<_, ()>(
      Invoke::QueryDbDelete.as_ref(),
      &InvokeQueryDbDeleteArgs { query_id },
    )
    .await;
    self.load_queries().await;
  }
}

