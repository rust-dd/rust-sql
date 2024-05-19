use leptos::*;

use crate::store::atoms::QueryPerformanceContext;

#[component]
pub fn Performance() -> impl IntoView {
  let performance = expect_context::<QueryPerformanceContext>();

  view! {
      <div class="p-4">
          <h1 class="text-2xl font-bold">"Performance"</h1>
          <div class="mt-4">
              <For
                  each=move || performance.get()
                  key=|item| item.id.to_string()
                  children=move |item| {
                      view! {
                          <div class="flex flex-row items-center justify-between p-2 border-b border-neutral-200 text-xs">
                              {item.message.clone()}
                          </div>
                      }
                  }
              />

          </div>
      </div>
  }
}

