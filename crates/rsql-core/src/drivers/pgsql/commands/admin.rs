use crate::AppState;
use crate::drivers::pgsql::extensions::{
    load_available_extensions, load_enum_types, load_extensions, load_pg_settings,
};
use crate::drivers::pgsql::query_execution::execute_query;
use crate::drivers::pgsql::roles_schema_objects::{
    DbGrant, PgRole, SchemaObject, TableGrant, extract_schema_objects, import_csv_to_table,
    load_database_grants, load_roles, load_table_grants, parse_csv_preview,
};
use crate::error::AppError;

use super::pool_helpers::acquire_client;

pub async fn pgsql_csv_preview(
    file_path: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>), AppError> {
    parse_csv_preview(file_path, 5).await
}

pub async fn pgsql_csv_import(
    app_state: &AppState,
    project_id: &str,
    file_path: &str,
    schema: &str,
    table: &str,
    column_mapping: Vec<(usize, String)>,
) -> Result<usize, AppError> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    import_csv_to_table(&client, file_path, schema, table, &column_mapping).await
}

pub async fn pgsql_load_roles(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<PgRole>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_roles(&client).await
}

pub async fn pgsql_load_table_grants(
    app_state: &AppState,
    project_id: &str,
    role_name: &str,
) -> Result<Vec<TableGrant>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_grants(&client, role_name).await
}

pub async fn pgsql_load_database_grants(
    app_state: &AppState,
    project_id: &str,
    role_name: &str,
) -> Result<Vec<DbGrant>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_database_grants(&client, role_name).await
}

pub async fn pgsql_extract_schema_objects(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<SchemaObject>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    extract_schema_objects(&client, schema).await
}

pub async fn pgsql_load_extensions(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_extensions(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_available_extensions(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_available_extensions(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_load_enum_types(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_enum_types(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}

pub async fn pgsql_table_action(
    app_state: &AppState,
    project_id: &str,
    action: &str,
    schema: &str,
    table: &str,
    object_type: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.clients, project_id).await?;

    fn qi(name: &str) -> String {
        format!("\"{}\"", name.replace('"', "\"\""))
    }

    let qualified = format!("{}.{}", qi(schema), qi(table));

    let sql = match (object_type, action) {
        ("table", "ANALYZE") => format!("ANALYZE {qualified}"),
        ("table", "VACUUM") => format!("VACUUM {qualified}"),
        ("table", "VACUUM FULL") => format!("VACUUM FULL {qualified}"),
        ("table", "REINDEX") => format!("REINDEX TABLE {qualified}"),
        ("table", "TRUNCATE") => format!("TRUNCATE TABLE {qualified}"),
        ("table", "DROP TABLE") => format!("DROP TABLE {qualified}"),
        ("view", "DROP VIEW") => format!("DROP VIEW {qualified}"),
        ("view", "DROP VIEW CASCADE") => format!("DROP VIEW {qualified} CASCADE"),
        ("matview", "REFRESH") => format!("REFRESH MATERIALIZED VIEW {qualified}"),
        ("matview", "REFRESH CONCURRENTLY") => {
            format!("REFRESH MATERIALIZED VIEW CONCURRENTLY {qualified}")
        }
        ("matview", "DROP MATERIALIZED VIEW") => format!("DROP MATERIALIZED VIEW {qualified}"),
        ("function" | "trigger-function", "DROP FUNCTION") => format!("DROP FUNCTION {qualified}"),
        ("function" | "trigger-function", "DROP FUNCTION CASCADE") => {
            format!("DROP FUNCTION {qualified} CASCADE")
        }
        _ => {
            return Err(AppError::QueryFailed(format!(
                "Unknown action '{}' for object type '{}'",
                action, object_type
            )));
        }
    };

    execute_query(&client, &sql).await?;

    Ok(format!("{action} completed successfully."))
}

pub async fn pgsql_load_pg_settings(
    app_state: &AppState,
    project_id: &str,
) -> Result<String, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_pg_settings(&client).await?;
    sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))
}
