//! rsql-core: shared business logic for the rsql desktop and proxy builds.
//! Pure Rust — no Tauri, no axum.

pub mod common;
pub mod drivers;
pub mod error;
pub mod ssh;
pub mod state;
pub mod utils;

pub use state::AppState;
