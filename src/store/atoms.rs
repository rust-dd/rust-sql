use std::collections::VecDeque;

use common::enums::Drivers;
use leptos::RwSignal;
use rsql::StructIntoIterator;

#[derive(Debug, Default, Clone)]
pub struct QueryPerformanceAtom {
  pub id: usize,
  pub message: String,
}

impl QueryPerformanceAtom {
  pub fn new(id: usize, sql: &str, query_time: f32) -> Self {
    Self {
      id,
      message: format!(
        "[{}]: {} is executed in {} ms",
        chrono::Utc::now(),
        sql,
        query_time
      ),
    }
  }
}

pub type QueryPerformanceContext = RwSignal<VecDeque<QueryPerformanceAtom>>;

#[derive(Debug, Default, Clone)]
pub struct RunQueryAtom {
  pub is_running: bool,
}

pub type RunQueryContext = RwSignal<RunQueryAtom>;

#[derive(Clone, StructIntoIterator)]
pub struct PgsqlConnectionDetailsAtom {
  pub project_id: String,
  pub driver: Drivers,
  pub user: String,
  pub password: String,
  pub host: String,
  pub port: String,
}

impl Default for PgsqlConnectionDetailsAtom {
  fn default() -> Self {
    Self {
      project_id: String::new(),
      driver: Drivers::PGSQL,
      user: String::new(),
      password: String::new(),
      host: String::new(),
      port: String::new(),
    }
  }
}

pub type PgsqlConnectionDetailsContext = RwSignal<PgsqlConnectionDetailsAtom>;

