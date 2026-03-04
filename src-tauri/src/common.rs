use std::collections::BTreeMap;

pub mod enums;
pub mod pgsql;

pub type BTreeVecStore = BTreeMap<String, Vec<String>>;
