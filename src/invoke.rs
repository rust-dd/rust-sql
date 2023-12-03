use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct InvokePostgresConnectionArgs {
    pub key: String,
}

#[derive(Serialize, Deserialize)]
pub struct InvokeTablesArgs {
    pub schema: String,
}

