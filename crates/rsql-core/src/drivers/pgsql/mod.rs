pub mod commands;
pub mod ddl_generation;
pub mod extensions;
pub mod metadata_schema;
pub mod metadata_views_functions;
pub mod query_execution;
pub mod roles_schema_objects;
pub mod statistics_activity;
pub mod streaming;

use deadpool_postgres::Pool;
use std::sync::Arc;

use crate::error::AppError;

/// Safely get a pool Arc from the AppState client map.
/// Returns a cloned Arc so the caller can drop the MutexGuard immediately.
pub fn get_pool(
    clients_guard: &std::collections::BTreeMap<String, Arc<Pool>>,
    project_id: &str,
) -> Result<Arc<Pool>, AppError> {
    clients_guard
        .get(project_id)
        .cloned()
        .ok_or_else(|| AppError::ClientNotConnected(project_id.to_string()))
}

/// Cell separator for packed format (Unit Separator, ASCII 0x1F)
pub const CELL_SEP: char = '\x1F';
/// Row separator for packed format (Record Separator, ASCII 0x1E)
pub const ROW_SEP: char = '\x1E';

/// A cached query: pre-packed page strings for zero-copy serving.
/// Each page is a single large String (~1-2 MB) so the OS reclaims RSS on drop.
pub struct CachedQuery {
    pub pages: Vec<String>,
    pub page_size: usize,
}

pub type VirtualCache = std::collections::BTreeMap<String, CachedQuery>;

/// Column detail info: (name, data_type, nullable, default_value)
pub type ColumnDetail = (String, String, bool, Option<String>);

/// Index info: (index_name, column_name, is_unique, is_primary)
pub type IndexDetail = (String, String, bool, bool);

/// Trigger info: (trigger_name, event, timing)
pub type TriggerDetail = (String, String, String);

/// Rule info: (rule_name, event)
pub type RuleDetail = (String, String);

/// Policy info: (policy_name, permissive, command)
pub type PolicyDetail = (String, String, String);

/// Function info: (name, return_type, arguments)
pub type FunctionInfo = (String, String, String);

/// Database stats: (stat_name, stat_value)
pub type DbStat = (String, String);

/// Constraint info: (constraint_name, constraint_type, column_name)
pub type ConstraintDetail = (String, String, String);

/// FK relation: (source_table, source_column, target_table, target_column)
pub type ForeignKeyInfo = (String, String, String, String);

/// Table statistics: Vec of (key, value) pairs
pub type ObjectStats = Vec<(String, String)>;

/// FK detail: (constraint_name, source_schema, source_table, source_column, target_schema, target_table, target_column, on_update, on_delete)
pub type FKDetail = (
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
);
