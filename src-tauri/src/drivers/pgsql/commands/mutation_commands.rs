use crate::AppState;
use crate::common::enums::AppError;
use crate::drivers::pgsql::mutation::{
    BuiltStatement, ColumnTypes, MutationKind, RowMutation, build_statement,
};

use tauri::{Result, State};
use tokio_postgres::types::ToSql;

use super::pool_connection::{acquire_client, set_cancel_token};

#[derive(serde::Serialize)]
pub struct MutationReport {
    pub updated: usize,
    pub deleted: usize,
}

/// Column types straight from the catalog. Used both to cast parameters and to
/// reject column names the table does not actually have.
async fn load_column_types(
    client: &deadpool_postgres::Client,
    schema: &str,
    table: &str,
) -> std::result::Result<ColumnTypes, AppError> {
    let rows = client
        .query(
            "SELECT attname::text, format_type(atttypid, atttypmod)
             FROM pg_attribute
             WHERE attrelid = format('%I.%I', $1::text, $2::text)::regclass
               AND attnum > 0
               AND NOT attisdropped",
            &[&schema, &table],
        )
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    if rows.is_empty() {
        return Err(AppError::QueryFailed(format!(
            "Table {}.{} has no readable columns",
            schema, table
        )));
    }

    Ok(rows
        .into_iter()
        .map(|row| (row.get::<_, String>(0), row.get::<_, String>(1)))
        .collect())
}

/// Render a row key for error messages, e.g. `id=7, tenant=acme`.
fn describe_key(key: &[(String, Option<String>)]) -> String {
    key.iter()
        .map(|(column, value)| match value {
            Some(v) => format!("{}={}", column, v),
            None => format!("{}=NULL", column),
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// Apply grid row edits as parameterized statements in a single transaction.
///
/// Every statement must affect exactly one row. Zero means the row is gone or
/// its key changed underneath the grid; more than one means the supplied key is
/// not unique. Either aborts the whole transaction, so a partial apply is not
/// possible and a silent no-op is reported as an error instead of success.
#[tauri::command(rename_all = "snake_case")]
pub async fn pgsql_apply_row_mutations(
    project_id: &str,
    schema: &str,
    table: &str,
    mutations: Vec<RowMutation>,
    timeout_ms: Option<u32>,
    app_state: State<'_, AppState>,
) -> Result<MutationReport> {
    if mutations.is_empty() {
        return Ok(MutationReport {
            updated: 0,
            deleted: 0,
        });
    }

    let mut client = acquire_client(&app_state.clients, project_id).await?;
    set_cancel_token(&app_state, project_id, client.cancel_token()).await?;

    let types = load_column_types(&client, schema, table).await?;

    // Build everything up front so a rejected payload never opens a transaction.
    let planned: Vec<BuiltStatement> = mutations
        .iter()
        .map(|mutation| build_statement(schema, table, mutation, &types))
        .collect::<std::result::Result<_, AppError>>()?;

    let tx = client
        .transaction()
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    // Transaction-scoped, so it cannot leak into the pooled session the way a
    // session-level SET followed by RESET can when the reset never runs.
    if let Some(ms) = timeout_ms.filter(|ms| *ms > 0) {
        tx.batch_execute(&format!("SET LOCAL statement_timeout = {}", ms))
            .await
            .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    }

    let mut updated = 0usize;
    let mut deleted = 0usize;

    for (mutation, statement) in mutations.iter().zip(&planned) {
        let params: Vec<&(dyn ToSql + Sync)> = statement
            .params
            .iter()
            .map(|p| p as &(dyn ToSql + Sync))
            .collect();

        let affected = tx
            .execute(statement.sql.as_str(), &params)
            .await
            .map_err(|e| AppError::QueryFailed(e.to_string()))?;

        if affected != 1 {
            let key = describe_key(&mutation.pk);
            // Dropping `tx` without committing rolls the whole batch back.
            return Err(AppError::QueryFailed(format!(
                "Expected 1 row for {} but matched {}. Row key: {}. \
                 Nothing was changed — refresh the results and try again.",
                match mutation.kind {
                    MutationKind::Update => "update",
                    MutationKind::Delete => "delete",
                },
                affected,
                key
            ))
            .into());
        }

        match mutation.kind {
            MutationKind::Update => updated += 1,
            MutationKind::Delete => deleted += 1,
        }
    }

    tx.commit()
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    Ok(MutationReport { updated, deleted })
}
