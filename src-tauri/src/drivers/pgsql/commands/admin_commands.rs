use crate::AppState;
use crate::common::enums::AppError;
use crate::drivers::pgsql::{
    DbGrant, PgRole, SchemaObject, TableGrant, execute_query, extract_schema_objects,
    import_csv_to_table, load_available_extensions, load_database_grants, load_enum_types,
    load_extensions, load_pg_settings, load_roles, load_table_grants, parse_csv_preview,
};

use tauri::ipc::Response;
use tauri::{Result, State};

use super::pool_connection::acquire_client;

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_preview(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>)> {
    parse_csv_preview(file_path, 5).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_csv_import(
    project_id: &str,
    file_path: &str,
    schema: &str,
    table: &str,
    column_mapping: Vec<(usize, String)>,
    app_state: State<'_, AppState>,
) -> Result<usize> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    import_csv_to_table(&client, file_path, schema, table, &column_mapping)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_roles(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<PgRole>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_roles(&client).await.map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_table_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<TableGrant>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_table_grants(&client, role_name)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_database_grants(
    project_id: &str,
    role_name: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<DbGrant>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    load_database_grants(&client, role_name)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_extract_schema_objects(
    project_id: &str,
    schema: &str,
    app_state: State<'_, AppState>,
) -> Result<Vec<SchemaObject>> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    extract_schema_objects(&client, schema)
        .await
        .map_err(Into::into)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_extensions(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_available_extensions(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_available_extensions(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_enum_types(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_enum_types(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_table_action(
    project_id: &str,
    action: &str,
    schema: &str,
    table: &str,
    object_type: &str,
    app_state: State<'_, AppState>,
) -> Result<String> {
    let client = acquire_client(&app_state.clients, project_id).await?;

    // Quote identifiers safely
    fn qi(name: &str) -> String {
        format!("\"{}\"", name.replace('"', "\"\""))
    }

    let qualified = format!("{}.{}", qi(schema), qi(table));

    let sql = match (object_type, action) {
        // Table actions
        ("table", "ANALYZE") => format!("ANALYZE {qualified}"),
        ("table", "VACUUM") => format!("VACUUM {qualified}"),
        ("table", "VACUUM FULL") => format!("VACUUM FULL {qualified}"),
        ("table", "REINDEX") => format!("REINDEX TABLE {qualified}"),
        ("table", "TRUNCATE") => format!("TRUNCATE TABLE {qualified}"),
        ("table", "DROP TABLE") => format!("DROP TABLE {qualified}"),
        // View actions
        ("view", "DROP VIEW") => format!("DROP VIEW {qualified}"),
        ("view", "DROP VIEW CASCADE") => format!("DROP VIEW {qualified} CASCADE"),
        // Materialized view actions
        ("matview", "REFRESH") => format!("REFRESH MATERIALIZED VIEW {qualified}"),
        ("matview", "REFRESH CONCURRENTLY") => {
            format!("REFRESH MATERIALIZED VIEW CONCURRENTLY {qualified}")
        }
        ("matview", "DROP MATERIALIZED VIEW") => format!("DROP MATERIALIZED VIEW {qualified}"),
        // Function actions
        ("function" | "trigger-function", "DROP FUNCTION") => format!("DROP FUNCTION {qualified}"),
        ("function" | "trigger-function", "DROP FUNCTION CASCADE") => {
            format!("DROP FUNCTION {qualified} CASCADE")
        }
        _ => {
            return Err(AppError::QueryFailed(format!(
                "Unknown action '{}' for object type '{}'",
                action, object_type
            ))
            .into());
        }
    };

    execute_query(&client, &sql).await.map_err(|e| e)?;

    Ok(format!("{action} completed successfully."))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_load_pg_settings(
    project_id: &str,
    app_state: State<'_, AppState>,
) -> Result<Response> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    let result = load_pg_settings(&client).await?;
    let json = sonic_rs::to_string(&result).map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(Response::new(json))
}
