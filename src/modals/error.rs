use leptos::*;
use thaw::{Modal, ModalFooter};

#[component]
pub fn Error<F>(show: RwSignal<bool>, message: String, on_click: F) -> impl IntoView
where
  F: Fn() + Copy + Clone + 'static,
{
  view! {
      <Modal show=show title="Error">
          <p>{message}</p>
          <ModalFooter slot>
              <button class="btn btn-primary" on:click=move |_| on_click()>
                  Ok
              </button>
          </ModalFooter>
      </Modal>
  }
}

