use std::collections::BTreeMap;

pub mod pgsql;

pub type BTreeVecStore = BTreeMap<String, Vec<String>>;
