use crate::{
    invoke::{InvokePostgresConnectionArgs, InvokeTablesArgs},
    wasm_functions::invoke,
};
use leptos::{create_rw_signal, RwSignal, SignalGetUntracked, SignalSet, SignalUpdate};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug)]
pub struct DBStore {
    pub db_host: RwSignal<String>,
    pub db_port: RwSignal<String>,
    pub db_user: RwSignal<String>,
    pub db_password: RwSignal<String>,
    pub schemas: RwSignal<HashMap<String, bool>>,
    pub is_connecting: RwSignal<bool>,
    pub tables: RwSignal<HashMap<String, Vec<String>>>,
}

impl Default for DBStore {
    fn default() -> Self {
        Self::new()
    }
}

impl DBStore {
    pub fn new() -> Self {
        Self {
            schemas: create_rw_signal(HashMap::new()),
            tables: create_rw_signal(HashMap::new()),
            is_connecting: create_rw_signal(false),
            db_host: create_rw_signal(String::new()),
            db_port: create_rw_signal(String::new()),
            db_user: create_rw_signal(String::new()),
            db_password: create_rw_signal(String::new()),
        }
    }

    pub fn create_connection_string(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}",
            self.db_user.get_untracked(),
            self.db_password.get_untracked(),
            self.db_host.get_untracked(),
            self.db_port.get_untracked(),
        )
    }

    pub async fn connect(&mut self) {
        if !self.schemas.get_untracked().is_empty() {
            return;
        }
        self.is_connecting.set(true);
        let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
            key: self.create_connection_string(),
        })
        .unwrap();
        let schemas = invoke("pg_connector", args).await;
        let schemas = serde_wasm_bindgen::from_value::<Vec<String>>(schemas).unwrap();
        for schema in schemas {
            self.schemas.update(|prev| {
                prev.insert(schema.clone(), false);
            });
        }
        self.is_connecting.set(false);
    }

    pub async fn get_tables(&mut self, schema: String) -> Result<Vec<String>, ()> {
        if let Some(tables) = self.tables.get_untracked().get(&schema) {
            if !tables.is_empty() {
                return Ok(tables.clone());
            }
        }

        let args = serde_wasm_bindgen::to_value(&InvokeTablesArgs {
            schema: schema.to_string(),
        })
        .unwrap();
        let tables = invoke("get_schema_tables", args).await;
        let mut tables = serde_wasm_bindgen::from_value::<Vec<String>>(tables).unwrap();
        tables.sort();
        self.tables.update(|prev| {
            prev.insert(schema, tables.clone());
        });
        Ok(tables)
    }
}

