use crate::error::AppError;

pub async fn parse_csv_preview(
    file_path: &str,
    max_rows: usize,
) -> Result<(Vec<String>, Vec<Vec<String>>), AppError> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_path(file_path)
        .map_err(|e| AppError::QueryFailed(format!("Failed to read CSV: {}", e)))?;

    let headers: Vec<String> = rdr
        .headers()
        .map_err(|e| AppError::QueryFailed(format!("Failed to parse CSV headers: {}", e)))?
        .iter()
        .map(|h| h.to_string())
        .collect();

    let mut rows = Vec::new();
    for result in rdr.records().take(max_rows) {
        let record =
            result.map_err(|e| AppError::QueryFailed(format!("CSV parse error: {}", e)))?;
        rows.push(record.iter().map(|f| f.to_string()).collect());
    }

    Ok((headers, rows))
}

pub async fn import_csv_to_table(
    client: &deadpool_postgres::Client,
    file_path: &str,
    schema: &str,
    table: &str,
    column_mapping: &[(usize, String)],
) -> Result<usize, AppError> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_path(file_path)
        .map_err(|e| AppError::QueryFailed(format!("Failed to read CSV: {}", e)))?;

    if column_mapping.is_empty() {
        return Err(AppError::QueryFailed(
            "No column mapping provided".to_string(),
        ));
    }

    let col_names: Vec<String> = column_mapping
        .iter()
        .map(|(_, name)| format!("\"{}\"", name))
        .collect();
    let placeholders: Vec<String> = (1..=column_mapping.len())
        .map(|i| format!("${}", i))
        .collect();

    let insert_sql = format!(
        "INSERT INTO \"{}\".\"{}\" ({}) VALUES ({})",
        schema,
        table,
        col_names.join(", "),
        placeholders.join(", "),
    );

    let statement = client
        .prepare(&insert_sql)
        .await
        .map_err(|e| AppError::QueryFailed(format!("Failed to prepare statement: {}", e)))?;

    client
        .execute("BEGIN", &[])
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;

    let mut imported = 0usize;
    for result in rdr.records() {
        let record = result.map_err(|e| {
            AppError::QueryFailed(format!("CSV parse error at row {}: {}", imported + 1, e))
        })?;

        let values: Vec<String> = column_mapping
            .iter()
            .map(|(idx, _)| record.get(*idx).unwrap_or("").to_string())
            .collect();

        let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = values
            .iter()
            .map(|v| v as &(dyn tokio_postgres::types::ToSql + Sync))
            .collect();

        match client.execute(&statement, &params).await {
            Ok(_) => imported += 1,
            Err(e) => {
                client.execute("ROLLBACK", &[]).await.ok();
                return Err(AppError::QueryFailed(format!(
                    "Import failed at row {}: {}",
                    imported + 1,
                    e
                )));
            }
        }
    }

    client
        .execute("COMMIT", &[])
        .await
        .map_err(|e| AppError::QueryFailed(format!("Failed to commit: {}", e)))?;

    Ok(imported)
}
