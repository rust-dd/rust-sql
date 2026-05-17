use std::{collections::BTreeMap, sync::Arc};

use deadpool_postgres::{Manager as PgManager, ManagerConfig, Pool, RecyclingMethod};
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::{CancelToken, Config, NoTls};

use crate::AppState;
use crate::drivers::pgsql::get_pool;
use crate::error::AppError;

pub fn is_sqlite_lock_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("database is locked") || lower.contains("database busy")
}

pub fn full_error_chain(e: &dyn std::error::Error) -> String {
    let mut msg = e.to_string();
    let mut src = e.source();
    while let Some(cause) = src {
        msg.push_str(": ");
        msg.push_str(&cause.to_string());
        src = cause.source();
    }
    msg
}

pub fn create_pg_pool(
    cfg: &Config,
    use_ssl: bool,
    max_size: usize,
) -> std::result::Result<Pool, AppError> {
    let manager_config = ManagerConfig {
        recycling_method: RecyclingMethod::Custom("ROLLBACK".into()),
    };

    if use_ssl {
        let tls_connector = TlsConnector::builder()
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))?;
        let tls = MakeTlsConnector::new(tls_connector);
        let manager = PgManager::from_config(cfg.clone(), tls, manager_config);
        Pool::builder(manager)
            .max_size(max_size)
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))
    } else {
        let manager = PgManager::from_config(cfg.clone(), NoTls, manager_config);
        Pool::builder(manager)
            .max_size(max_size)
            .build()
            .map_err(|e| AppError::ConnectionFailed(e.to_string()))
    }
}

pub async fn acquire_client(
    pools_mutex: &tokio::sync::Mutex<BTreeMap<String, Arc<Pool>>>,
    project_id: &str,
) -> std::result::Result<deadpool_postgres::Client, AppError> {
    let pool = {
        let pools = pools_mutex.lock().await;
        get_pool(&pools, project_id)?
    };

    pool.get()
        .await
        .map_err(|e| AppError::ConnectionFailed(e.to_string()))
}

pub async fn apply_statement_timeout(client: &deadpool_postgres::Client, timeout_ms: u32) {
    if timeout_ms > 0 {
        client
            .simple_query(&format!("SET statement_timeout = {}", timeout_ms))
            .await
            .ok();
    }
}

pub async fn reset_statement_timeout(client: &deadpool_postgres::Client, timeout_ms: u32) {
    if timeout_ms > 0 {
        client.simple_query("RESET statement_timeout").await.ok();
    }
}

pub async fn set_cancel_token(
    app_state: &AppState,
    project_id: &str,
    token: CancelToken,
) -> std::result::Result<(), AppError> {
    let mut cancel_tokens = app_state.cancel_tokens.lock().await;
    cancel_tokens.insert(project_id.to_string(), token);
    Ok(())
}
