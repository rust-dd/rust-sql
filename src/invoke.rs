use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct InvokePostgresConnectionArgs {
    pub project: String,
    pub key: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeTablesArgs {
    pub schema: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeQueryArgs {
    pub sql: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectsArgs;

#[derive(Serialize, Deserialize)]
pub struct InvokeProjectDetailsArgs {
    pub project: String,
}

