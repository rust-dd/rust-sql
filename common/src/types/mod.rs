use std::collections::BTreeMap;

pub mod pgsql;

pub type BTreeStore = BTreeMap<String, String>;
pub type BTreeVecStore = BTreeMap<String, Vec<String>>;

