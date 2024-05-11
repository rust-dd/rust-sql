use leptos::*;

use super::tables::Tables;

#[component]
pub fn Schema(schema: String) -> impl IntoView {
  let (show_tables, set_show_tables) = create_signal(false);

  view! {
      <div>
          <div
              class="hover:font-semibold cursor-pointer sticky top-0 z-10 bg-white"
              on:click=move |_| set_show_tables(!show_tables())
          >
              {&schema}
          </div>
          <div class="pl-1">
              <Suspense fallback=move || {
                  view! { <p>"Loading..."</p> }
              }>

                  {
                      let schema = schema.clone();
                      view! {
                          <Show when=show_tables fallback=|| view! {}>

                              {
                                  let schema = schema.clone();
                                  view! {
                                      // <Tables schema=schema project=project/>
                                      <div></div>
                                  }
                              }

                          </Show>
                      }
                  }

              </Suspense>
          </div>
      </div>
  }
}

