use leptos::*;

use crate::{
  enums::QueryTableLayout,
  layout,
  store::{
    active_project::ActiveProjectStore, projects::ProjectsStore, query::QueryStore, tabs::TabsStore,
  },
};

pub fn app() -> impl IntoView {
  provide_context(QueryStore::default());
  provide_context(ProjectsStore::default());
  provide_context(create_rw_signal(QueryTableLayout::Grid));
  provide_context(ActiveProjectStore::default());
  provide_context(TabsStore::default());

  layout::component()
}
