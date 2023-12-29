use std::{cell::RefCell, rc::Rc};

use leptos::{html::*, *};
use leptos_use::use_event_listener;
use monaco::{
  api::{CodeEditor, CodeEditorOptions},
  sys::editor::{IDimension, IEditorMinimapOptions},
};
use wasm_bindgen::{closure::Closure, JsCast};

use crate::store::{editor::EditorState, query::QueryState};

pub type ModelCell = Rc<RefCell<Option<CodeEditor>>>;

pub fn query_editor() -> impl IntoView {
  let query_state = use_context::<QueryState>().unwrap();
  let run_query = create_action(move |query_store: &QueryState| {
    let query_store = *query_store;
    async move {
      query_store.run_query().await;
    }
  });
  let editor = use_context::<EditorState>().unwrap().editor;
  let node_ref = create_node_ref();
  let _ = use_event_listener(node_ref, ev::keydown, move |event| {
    if event.key() == "Enter" && event.ctrl_key() {
      run_query.dispatch(query_state);
    }
  });

  node_ref.on_load(move |node| {
    let div_element: &web_sys::HtmlDivElement = &node;
    let html_element = div_element.unchecked_ref::<web_sys::HtmlElement>();
    let options = CodeEditorOptions::default().to_sys_options();
    options.set_value(Some("SELECT * FROM users LIMIT 100;"));
    options.set_language(Some("sql"));
    options.set_automatic_layout(Some(true));
    options.set_dimension(Some(&IDimension::new(0, 240)));

    let minimap_settings = IEditorMinimapOptions::default();
    minimap_settings.set_enabled(Some(false));
    options.set_minimap(Some(&minimap_settings));

    let e = CodeEditor::create(html_element, Some(options));
    let keycode = monaco::sys::KeyMod::win_ctrl() as u32 | monaco::sys::KeyCode::Enter.to_value();
    e.as_ref().add_command(
      keycode.into(),
      Closure::<dyn Fn()>::new(|| ()).as_ref().unchecked_ref(),
      None,
    );
    editor.update(|prev| {
      prev.replace(Some(e));
    });
  });

  div()
    .classes("border-b-1 border-neutral-200 sticky")
    .node_ref(node_ref)
}
