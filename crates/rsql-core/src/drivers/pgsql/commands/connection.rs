use tokio_postgres::Config;

use crate::error::AppError;

use super::pool_helpers::{create_pg_pool, full_error_chain};

pub async fn pgsql_test_connection(key: [&str; 6]) -> Result<String, AppError> {
    let user = key[0];
    let password = key[1];
    let database = key[2];
    let host = key[3];
    let port: u16 = key[4].parse().unwrap_or(5432);
    let use_ssl = key[5] == "true";

    let mut cfg = Config::new();
    cfg.user(user)
        .password(password)
        .dbname(database)
        .host(host)
        .port(port);

    let pool = create_pg_pool(&cfg, use_ssl, 1)?;
    let client = pool
        .get()
        .await
        .map_err(|e| AppError::ConnectionFailed(full_error_chain(&e)))?;

    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;

    let version: String = row.get(0);
    Ok(version)
}
