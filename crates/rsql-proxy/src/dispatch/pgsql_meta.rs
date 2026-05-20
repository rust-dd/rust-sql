use uuid::Uuid;

use crate::protocol::Outbound;
use crate::session::ProxySession;

pub async fn handle(
    session: &ProxySession,
    cmd: &str,
    payload: serde_json::Value,
    id: Uuid,
) -> Result<Outbound, String> {
    match cmd {
        "pgsql_test_connection" | "pgsql_connector" => {
            super::pgsql_meta_connection::handle(session, cmd, payload, id).await
        }

        "pgsql_load_databases"
        | "pgsql_load_tablespaces"
        | "pgsql_load_schemas"
        | "pgsql_load_tables"
        | "pgsql_load_columns"
        | "pgsql_load_column_details"
        | "pgsql_load_indexes"
        | "pgsql_load_constraints"
        | "pgsql_load_triggers"
        | "pgsql_load_rules"
        | "pgsql_load_policies"
        | "pgsql_load_views"
        | "pgsql_load_materialized_views"
        | "pgsql_load_functions"
        | "pgsql_load_trigger_functions" => {
            super::pgsql_meta_metadata::handle(session, cmd, payload, id).await
        }

        "pgsql_load_activity"
        | "pgsql_load_database_stats"
        | "pgsql_load_table_stats"
        | "pgsql_load_foreign_keys"
        | "pgsql_table_statistics"
        | "pgsql_fk_details"
        | "pgsql_load_locks"
        | "pgsql_load_index_usage"
        | "pgsql_load_table_bloat" => {
            super::pgsql_meta_statistics::handle(session, cmd, payload, id).await
        }

        "pgsql_view_info" | "pgsql_matview_info" | "pgsql_function_info" | "pgsql_generate_ddl" => {
            super::pgsql_meta_objects::handle(session, cmd, payload, id).await
        }

        "pgsql_csv_preview"
        | "pgsql_csv_import"
        | "pgsql_load_roles"
        | "pgsql_load_table_grants"
        | "pgsql_load_database_grants"
        | "pgsql_extract_schema_objects"
        | "pgsql_load_extensions"
        | "pgsql_load_available_extensions"
        | "pgsql_load_enum_types"
        | "pgsql_table_action"
        | "pgsql_load_pg_settings" => {
            super::pgsql_meta_admin::handle(session, cmd, payload, id).await
        }

        _ => Err(format!("pgsql_meta: unknown command: {cmd}")),
    }
}
