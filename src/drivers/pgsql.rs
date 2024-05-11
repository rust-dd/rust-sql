use ahash::AHashMap;

use common::enums::ProjectConnectionStatus;
use leptos::{RwSignal, SignalSet};
use tauri_sys::tauri::invoke;

use crate::invoke::{Invoke, InvokePostgresConnectorArgs};

pub struct Pgsql<'a> {
  pub name: &'a str,
  user: Option<&'a str>,
  password: Option<&'a str>,
  host: Option<&'a str>,
  port: Option<&'a str>,
  connection_string: Option<String>,
  pub status: RwSignal<ProjectConnectionStatus>,
  pub schemas: RwSignal<AHashMap<String, Vec<String>>>,
}

impl<'a> Pgsql<'a> {
  pub fn new(
    name: &'a str,
    user: Option<&'a str>,
    password: Option<&'a str>,
    host: Option<&'a str>,
    port: Option<&'a str>,
  ) -> Self {
    Self {
      name,
      status: RwSignal::default(),
      schemas: RwSignal::default(),
      user,
      password,
      host,
      port,
      connection_string: None,
    }
  }

  pub async fn connector(&self) {
    self.status.set(ProjectConnectionStatus::Connecting);
    let status = invoke::<_, ProjectConnectionStatus>(
      Invoke::pgsql_connector.as_ref(),
      &InvokePostgresConnectorArgs {
        project_name: &self.name,
        key: &self.connection_string.as_ref().unwrap(),
      },
    )
    .await
    .unwrap();
    self.status.set(status);
  }

  pub async fn load_schemas() {
    unimplemented!()
  }

  pub async fn load_tables() {
    unimplemented!()
  }

  pub async fn run_query() {
    unimplemented!()
  }

  fn generate_connection_string(&mut self) {
    let connection_string = format!(
      "user={} password={} host={} port={}",
      self.user.as_ref().unwrap(),
      self.password.as_ref().unwrap(),
      self.host.as_ref().unwrap(),
      self.port.as_ref().unwrap(),
    );
    self.connection_string = Some(connection_string);
  }
}

