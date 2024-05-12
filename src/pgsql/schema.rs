use std::rc::Rc;

use leptos::*;
use leptos_icons::*;

use super::{driver::Pgsql, table::Table};

#[component]
pub fn Schema(schema: String) -> impl IntoView {
  let (show, set_show) = create_signal(false);
  let (is_loading, set_is_loading) = create_signal(false);
  let schema = Rc::new(schema);
  let pgsql = expect_context::<Pgsql>();
  let load_tables = create_action(move |schema: &String| {
    let schema = schema.clone();
    async move {
      pgsql.load_tables(&schema).await;
      set_is_loading(false);
      set_show(!show());
    }
  });

  view! {
      <div>
          <button
              class="hover:font-semibold cursor-pointer sticky top-0 z-10 bg-white flex flex-row items-center gap-1 disabled:opacity-50 disabled:font-normal"
              on:click={
                  let schema = schema.clone();
                  move |_| {
                      set_is_loading(true);
                      let schema = (*schema).clone();
                      load_tables.dispatch(schema.clone());
                  }
              }
          >

              <Show when=is_loading fallback=|| view! {}>
                  <Icon
                      icon=icondata::HiArrowPathOutlineLg
                      class="animate-spin"
                      width="12"
                      height="12"
                  />
              </Show>

              {(*schema).clone()}
          </button>

          {
              view! {
                  <div class="pl-2">
                      <Show when=show fallback=|| view! {}>
                          <For
                              each={
                                  let schema = schema.clone();
                                  move || {
                                      let schema = (*schema).clone();
                                      pgsql.select_tables_by_schema(&schema).unwrap()
                                  }
                              }

                              key=|table| table.0.clone()
                              children=move |table| {
                                  view! { <Table table schema=None project=None/> }
                              }
                          />

                      </Show>
                  </div>
              }
          }

      </div>
  }
}

