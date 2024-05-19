use std::{collections::VecDeque, default};

use leptos::RwSignal;

#[derive(Debug, Default, Clone)]
pub struct QueryPerformanceAtom {
  pub id: usize,
  pub message: Option<String>,
}

pub type QueryPerformanceContext = RwSignal<VecDeque<QueryPerformanceAtom>>;

#[derive(Debug, Default, Clone)]
pub struct RunQueryAtom {
  pub is_running: bool,
}

pub type RunQueryContext = RwSignal<RunQueryAtom>;

