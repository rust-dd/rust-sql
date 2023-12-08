use crate::{
    invoke::{InvokePostgresConnectionArgs, InvokeTablesArgs},
    wasm_functions::invoke,
};
use leptos::{create_rw_signal, RwSignal, SignalGetUntracked, SignalSet, SignalUpdate};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug)]
pub struct DBStore {
    pub project: RwSignal<String>,
    pub db_host: RwSignal<String>,
    pub db_port: RwSignal<String>,
    pub db_user: RwSignal<String>,
    pub db_password: RwSignal<String>,
    pub schemas: RwSignal<HashMap<String, bool>>,
    pub is_connecting: RwSignal<bool>,
    pub tables: RwSignal<HashMap<String, Vec<(String, bool)>>>,
}

impl Default for DBStore {
    fn default() -> Self {
        Self::new(None, None, None, None, None)
    }
}

impl DBStore {
    pub fn new(
        project: Option<String>,
        db_host: Option<String>,
        db_post: Option<String>,
        db_user: Option<String>,
        db_password: Option<String>,
    ) -> Self {
        Self {
            project: create_rw_signal(project.unwrap_or(String::new())),
            db_host: create_rw_signal(db_host.unwrap_or(String::new())),
            db_port: create_rw_signal(db_post.unwrap_or(String::new())),
            db_user: create_rw_signal(db_user.unwrap_or(String::new())),
            db_password: create_rw_signal(db_password.unwrap_or(String::new())),
            schemas: create_rw_signal(HashMap::new()),
            is_connecting: create_rw_signal(false),
            tables: create_rw_signal(HashMap::new()),
        }
    }

    pub fn reset(&mut self) {
        self.project.set(String::new());
        self.db_host.set(String::new());
        self.db_port.set(String::new());
        self.db_user.set(String::new());
        self.db_password.set(String::new());
        self.schemas.set(HashMap::new());
        self.is_connecting.set(false);
        self.tables.set(HashMap::new());
    }

    pub fn create_connection_string(&self) -> String {
        format!(
            "user={} password={} host={} port={}",
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
        self.reset();
        self.is_connecting.set(true);
        let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
            project: self.project.get_untracked(),
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

    pub async fn get_tables(&mut self, schema: String) -> Result<Vec<(String, bool)>, ()> {
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
        let tables = tables
            .into_iter()
            .map(|t| (t, false))
            .collect::<Vec<(String, bool)>>();
        self.tables.update(|prev| {
            prev.insert(schema, tables.clone());
        });
        Ok(tables)
    }

    pub async fn get_project_details(&mut self, project: String) -> Result<(), ()> {
        let args = serde_wasm_bindgen::to_value(&InvokePostgresConnectionArgs {
            project: project.clone(),
            key: String::new(),
        })
        .unwrap();
        let project_details = invoke("get_project_details", args).await;
        let project_details =
            serde_wasm_bindgen::from_value::<HashMap<String, String>>(project_details).unwrap();
        self.project.set(project);
        self.db_user
            .set(project_details.get("user").unwrap().to_string());
        self.db_password
            .set(project_details.get("password").unwrap().to_string());
        self.db_host
            .set(project_details.get("host").unwrap().to_string());
        self.db_port
            .set(project_details.get("port").unwrap().to_string());
        Ok(())
    }
}

