use std::collections::BTreeMap;

use leptos::RwSignal;

pub mod atoms;
pub mod projects;
pub mod queries;
pub mod tabs;

pub type BTreeStore = RwSignal<BTreeMap<String, String>>;

