use js_sys::WebAssembly;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueryTableLayout {
  Grid,
  Records,
}
