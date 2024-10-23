use ahash::AHashMap;
use common::{
  enums::ProjectConnectionStatus,
  types::pgsql::{PgsqlLoadSchemas, PgsqlLoadTables, PgsqlRunQuery},
};
use leptos::{error::Result, expect_context, RwSignal, SignalGet, SignalSet, SignalUpdate};
use rsql_proc_macros::set_running_query;
use tauri_sys::core::invoke;

use crate::{
  invoke::{
    Invoke, InvokePgsqlConnectorArgs, InvokePgsqlLoadSchemasArgs, InvokePgsqlLoadTablesArgs,
    InvokePgsqlRunQueryArgs,
  },
  store::{
    atoms::{
      PgsqlConnectionDetailsContext, QueryPerformanceAtom, QueryPerformanceContext, RunQueryAtom,
      RunQueryContext,
    },
    tabs::TabsStore,
  },
};

#[derive(Debug, Clone, Copy)]
pub struct Pgsql<'a> {
  pub project_id: RwSignal<String>,
  user: Option<&'a str>,
  password: Option<&'a str>,
  database: Option<&'a str>,
  host: Option<&'a str>,
  port: Option<&'a str>,
  pub status: RwSignal<ProjectConnectionStatus>,
  pub schemas: RwSignal<Vec<String>>,
  pub tables: RwSignal<AHashMap<String, Vec<(String, String)>>>,
}

impl<'a> Pgsql<'a> {
  pub fn new(project_id: String) -> Self {
    Self {
      project_id: RwSignal::new(project_id),
      status: RwSignal::default(),
      schemas: RwSignal::default(),
      tables: RwSignal::default(),
      user: None,
      password: None,
      database: None,
      host: None,
      port: None,
    }
  }

  pub async fn connector(&self) -> Result<ProjectConnectionStatus> {
    self
      .status
      .update(|prev| *prev = ProjectConnectionStatus::Connecting);
    let status = invoke::<ProjectConnectionStatus>(
      Invoke::PgsqlConnector.as_ref(),
      &InvokePgsqlConnectorArgs {
        project_id: &self.project_id.get(),
        key: Some([
          self.user.unwrap(),
          self.password.unwrap(),
          self.database.unwrap(),
          self.host.unwrap(),
          self.port.unwrap(),
        ]),
      },
    )
    .await;
    if status == ProjectConnectionStatus::Connected {
      self.load_schemas().await;
    }
    self.status.update(|prev| *prev = status.clone());
    Ok(status)
  }

  pub async fn load_schemas(&self) {
    let schemas = invoke::<PgsqlLoadSchemas>(
      Invoke::PgsqlLoadSchemas.as_ref(),
      &InvokePgsqlLoadSchemasArgs {
        project_id: &self.project_id.get(),
      },
    )
    .await;
    self.schemas.set(schemas);
  }

  pub async fn load_tables(&self, schema: &str) {
    if self.tables.get().contains_key(schema) {
      return;
    }
    let tables = invoke::<PgsqlLoadTables>(
      Invoke::PgsqlLoadTables.as_ref(),
      &InvokePgsqlLoadTablesArgs {
        project_id: &self.project_id.get(),
        schema,
      },
    )
    .await;
    self.tables.update(|prev| {
      prev.insert(schema.to_owned(), tables);
    });
  }

  #[set_running_query]
  pub async fn run_default_table_query(&self, sql: &str) {
    let tabs_store = expect_context::<TabsStore>();

    let selected_projects = tabs_store.selected_projects.get();
    let project_id = selected_projects.get(tabs_store.convert_selected_tab_to_index());

    if !selected_projects.is_empty()
      && project_id.is_some_and(|id| id.as_str() != self.project_id.get())
    {
      tabs_store.add_tab(&self.project_id.get());
    }

    tabs_store.set_editor_value(sql);
    tabs_store.selected_projects.update(|prev| {
      let index = tabs_store.convert_selected_tab_to_index();
      match prev.get_mut(index) {
        Some(project) => project.clone_from(&self.project_id.get()),
        None => prev.push(self.project_id.get().clone()),
      }
    });

    let query = invoke::<PgsqlRunQuery>(
      Invoke::PgsqlRunQuery.as_ref(),
      &InvokePgsqlRunQueryArgs {
        project_id: &self.project_id.get(),
        sql,
      },
    )
    .await;
    let (cols, rows, query_time) = query;
    tabs_store.sql_results.update(|prev| {
      let index = tabs_store.convert_selected_tab_to_index();
      match prev.get_mut(index) {
        Some(sql_result) => *sql_result = (cols, rows),
        None => prev.push((cols, rows)),
      }
    });
    let qp_store = expect_context::<QueryPerformanceContext>();
    qp_store.update(|prev| {
      let new = QueryPerformanceAtom::new(prev.len(), sql, query_time);
      prev.push_front(new);
    });
  }

  pub fn select_tables_by_schema(&self, schema: &str) -> Option<Vec<(String, String)>> {
    self.tables.get().get(schema).cloned()
  }

  pub fn load_connection_details(
    &mut self,
    user: &'a str,
    password: &'a str,
    database: &'a str,
    host: &'a str,
    port: &'a str,
  ) {
    self.user = Some(user);
    self.password = Some(password);
    self.database = Some(database);
    self.host = Some(host);
    self.port = Some(port);
  }

  pub fn edit_connection_details(&self) {
    let atom = expect_context::<PgsqlConnectionDetailsContext>();
    atom.update(|prev| {
      prev.project_id = self.project_id.get().clone();
      prev.user = self.user.unwrap().to_string();
      prev.password = self.password.unwrap().to_string();
      prev.database = self.database.unwrap().to_string();
      prev.host = self.host.unwrap().to_string();
      prev.port = self.port.unwrap().to_string();
    });
  }
}
