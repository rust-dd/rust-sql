use std::{collections::VecDeque, default};

use leptos::RwSignal;

#[derive(Debug, Default, Clone)]
pub struct QueryPerformanceAtom {
  pub id: usize,
  pub message: Option<String>,
  pub execution_time: Option<f32>,
  pub query: Option<String>,
}

pub type QueryPerformanceContext = RwSignal<VecDeque<QueryPerformanceAtom>>;

#[derive(Debug, Clone)]
pub struct RunQueryAtom {
  pub is_running: bool,
}

impl default::Default for RunQueryAtom {
  fn default() -> Self {
    Self { is_running: false }
  }
}

pub type RunQueryContext = RwSignal<RunQueryAtom>;

