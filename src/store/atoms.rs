use leptos::RwSignal;

#[derive(Debug, Default, Clone)]
pub struct QueryPerformanceAtom {
  pub message: Option<String>,
  pub execution_time: Option<f32>,
  pub query: Option<String>,
}

pub type QueryPerformanceContext = RwSignal<Vec<QueryPerformanceAtom>>;

#[derive(Debug, Default, Clone)]
pub struct ActiveTabAtom {
  pub id: usize,
}

pub type ActiveTabContext = RwSignal<ActiveTabAtom>;

#[derive(Debug, Default, Clone)]
pub struct SelectedTabAtom {
  pub id: String,
}

pub type SelectedTabContext = RwSignal<SelectedTabAtom>;

