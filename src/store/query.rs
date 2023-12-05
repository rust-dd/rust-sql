use leptos::{create_rw_signal, RwSignal};
use wasm_bindgen::JsValue;

#[derive(Clone, Debug)]
pub struct QueryState {
    pub query: RwSignal<JsValue>,
}

impl Default for QueryState {
    fn default() -> Self {
        Self::new()
    }
}

impl QueryState {
    pub fn new() -> Self {
        Self {
            query: create_rw_signal(JsValue::default()),
        }
    }
}

