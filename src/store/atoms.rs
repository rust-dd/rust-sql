use std::collections::VecDeque;

use leptos::RwSignal;

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

