use std::collections::BTreeMap;

use leptos::{error::Result, *};
use tauri_sys::tauri::invoke;

use crate::invoke::{
  Invoke, InvokeDeleteQueryArgs, InvokeInsertQueryArgs, InvokeSelectQueriesArgs,
};

use super::tabs::TabsStore;

#[derive(Clone, Copy, Debug)]
pub struct QueryStore(pub RwSignal<BTreeMap<String, String>>);

impl Default for QueryStore {
  fn default() -> Self {
    Self::new()
  }
}

impl QueryStore {
  #[must_use]
  pub fn new() -> Self {
    Self(create_rw_signal(BTreeMap::new()))
  }

  pub async fn select_queries(&self) -> Result<BTreeMap<String, String>> {
    let saved_queries = invoke::<_, BTreeMap<String, String>>(
      &Invoke::select_queries.to_string(),
      &InvokeSelectQueriesArgs,
    )
    .await?;

    self.0.update(|prev| {
      *prev = saved_queries.into_iter().collect();
    });
    Ok(self.0.get())
  }

  pub async fn insert_query(&self, key: &str, project_name: &str) -> Result<()> {
    let tabs_store = use_context::<TabsStore>().unwrap();
    let sql = tabs_store.select_active_editor_value();
    invoke(
      &Invoke::insert_query.to_string(),
      &InvokeInsertQueryArgs {
        key: &format!("{}:{}", project_name, key),
        sql: sql.as_str(),
      },
    )
    .await?;
    self.select_queries().await?;
    Ok(())
  }

  pub async fn delete_query(&self, key: &str) -> Result<()> {
    invoke(
      &Invoke::delete_query.to_string(),
      &InvokeDeleteQueryArgs { key },
    )
    .await?;
    self.select_queries().await?;
    Ok(())
  }
}
