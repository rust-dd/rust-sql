use crate::AppState;
use crate::common::pgsql::{PgsqlLoadColumns, PgsqlLoadSchemas, PgsqlLoadTables};
use crate::drivers::pgsql::metadata_schema::{
    load_column_details, load_columns, load_constraints, load_databases, load_indexes,
    load_policies, load_rules, load_schemas, load_tables, load_tablespaces, load_triggers,
};
use crate::drivers::pgsql::metadata_views_functions::{
    load_functions, load_materialized_views, load_trigger_functions, load_views,
};
use crate::drivers::pgsql::{
    ColumnDetail, ConstraintDetail, FunctionInfo, IndexDetail, PolicyDetail, RuleDetail,
    TriggerDetail, get_pool,
};
use crate::error::AppError;

use super::pool_helpers::acquire_client;

pub async fn pgsql_load_databases(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<String>, AppError> {
    let pool = {
        let pools = app_state.meta_clients.lock().await;
        get_pool(&pools, project_id)?
    };
    load_databases(&pool).await
}

pub async fn pgsql_load_tablespaces(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<(String, String, String)>, AppError> {
    let pool = {
        let pools = app_state.meta_clients.lock().await;
        get_pool(&pools, project_id)?
    };
    load_tablespaces(&pool).await
}

pub async fn pgsql_load_schemas(
    app_state: &AppState,
    project_id: &str,
) -> Result<PgsqlLoadSchemas, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_schemas(
        &client,
        r#"SELECT schema_name FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
           ORDER BY schema_name"#,
    )
    .await
}

pub async fn pgsql_load_tables(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<PgsqlLoadTables, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_tables(
        &client,
        r#"SELECT table_name,
                  pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS size
           FROM information_schema.tables
           WHERE table_schema = $1
           ORDER BY table_name"#,
        schema,
    )
    .await
}

pub async fn pgsql_load_columns(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<PgsqlLoadColumns, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_columns(&client, schema, table).await
}

pub async fn pgsql_load_column_details(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<ColumnDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_column_details(&client, schema, table).await
}

pub async fn pgsql_load_indexes(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<IndexDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_indexes(&client, schema, table).await
}

pub async fn pgsql_load_constraints(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<ConstraintDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_constraints(&client, schema, table).await
}

pub async fn pgsql_load_triggers(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<TriggerDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_triggers(&client, schema, table).await
}

pub async fn pgsql_load_rules(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<RuleDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_rules(&client, schema, table).await
}

pub async fn pgsql_load_policies(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
    table: &str,
) -> Result<Vec<PolicyDetail>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_policies(&client, schema, table).await
}

pub async fn pgsql_load_views(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<String>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_views(&client, schema).await
}

pub async fn pgsql_load_materialized_views(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<String>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_materialized_views(&client, schema).await
}

pub async fn pgsql_load_functions(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<FunctionInfo>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_functions(&client, schema).await
}

pub async fn pgsql_load_trigger_functions(
    app_state: &AppState,
    project_id: &str,
    schema: &str,
) -> Result<Vec<(String, String)>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;

    load_trigger_functions(&client, schema).await
}
