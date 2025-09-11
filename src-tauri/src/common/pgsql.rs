pub type PgsqlLoadSchemas = Vec<String>;
pub type PgsqlLoadTables = Vec<(String, String)>;
pub type PgsqlLoadColumns = Vec<String>;
pub type PgsqlRunQuery = (Vec<String>, Vec<Vec<String>>, f32);
