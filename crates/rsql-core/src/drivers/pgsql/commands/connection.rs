use std::sync::Arc;

use tokio_postgres::Config;

use crate::AppState;
use crate::error::{AppError, ProjectConnectionStatus};

use super::pool_helpers::{create_pg_pool, full_error_chain};

pub async fn pgsql_connector(
    state: &AppState,
    project_id: &str,
    key: Option<[&str; 6]>,
    ssh: Option<Vec<String>>,
) -> Result<ProjectConnectionStatus, AppError> {
    {
        let clients = state.clients.lock().await;
        if clients.contains_key(project_id) {
            return Ok(ProjectConnectionStatus::Connected);
        }
    }

    let (user, password, database, host, port_str, use_ssl) = match key {
        Some(k) => (
            k[0].to_string(),
            k[1].to_string(),
            k[2].to_string(),
            k[3].to_string(),
            k[4].to_string(),
            k[5] == "true",
        ),
        None => {
            let conn = state
                .local_db
                .connect()
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let mut rows = conn
                .query(
                    "SELECT username, password, database, host, port, ssl FROM projects WHERE id = ?1",
                    libsql::params![project_id],
                )
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?;
            let row = rows
                .next()
                .await
                .map_err(|e| AppError::DatabaseError(e.to_string()))?
                .ok_or_else(|| AppError::ProjectNotFound(project_id.to_string()))?;
            (
                row.get::<String>(0).unwrap_or_default(),
                row.get::<String>(1).unwrap_or_default(),
                row.get::<String>(2).unwrap_or_default(),
                row.get::<String>(3).unwrap_or_default(),
                row.get::<String>(4).unwrap_or_default(),
                row.get::<String>(5).map(|s| s == "true").unwrap_or(false),
            )
        }
    };

    let (effective_host, effective_port_str) = if let Some(ref ssh_params) = ssh {
        if ssh_params.len() >= 3 && !ssh_params[0].is_empty() {
            let ssh_host = &ssh_params[0];
            let ssh_port: u16 = ssh_params[1].parse().unwrap_or(22);
            let ssh_user = &ssh_params[2];
            let ssh_password = ssh_params
                .get(3)
                .filter(|s| !s.is_empty())
                .map(|s| s.as_str());
            let ssh_key_path = ssh_params
                .get(4)
                .filter(|s| !s.is_empty())
                .map(|s| s.as_str());

            state.ssh_tunnels.lock().await.remove(project_id);

            let tunnel = crate::ssh::start_tunnel(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key_path,
                &host,
                port_str.parse().unwrap_or(5432),
            )
            .await
            .map_err(|e| AppError::ConnectionFailed(e))?;

            let local_port = tunnel.local_port;
            state
                .ssh_tunnels
                .lock()
                .await
                .insert(project_id.to_string(), tunnel);

            ("127.0.0.1".to_string(), local_port.to_string())
        } else {
            (host.clone(), port_str.clone())
        }
    } else {
        (host.clone(), port_str.clone())
    };

    let port: u16 = effective_port_str.parse().unwrap_or(5432);
    let mut cfg = Config::new();
    cfg.user(&user)
        .password(&password)
        .dbname(&database)
        .host(&effective_host)
        .port(port);

    let query_pool = match create_pg_pool(&cfg, use_ssl, 16) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Query pool creation failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)));
        }
    };
    let meta_pool = match create_pg_pool(&cfg, use_ssl, 8) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::error!("Meta pool creation failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)));
        }
    };

    let query_client = match query_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Query pool initial connection failed: {:?}", e);
            return Err(AppError::ConnectionFailed(full_error_chain(&e)));
        }
    };
    if let Err(e) = meta_pool.get().await {
        tracing::error!("Meta pool initial connection failed: {:?}", e);
        return Err(AppError::ConnectionFailed(full_error_chain(&e)));
    }

    {
        let mut clients = state.clients.lock().await;
        clients.insert(project_id.to_string(), Arc::clone(&query_pool));
    }
    {
        let mut meta_clients = state.meta_clients.lock().await;
        meta_clients.insert(project_id.to_string(), Arc::clone(&meta_pool));
    }
    {
        let mut cancel_tokens = state.cancel_tokens.lock().await;
        cancel_tokens.insert(project_id.to_string(), query_client.cancel_token());
    }
    {
        let mut client_ssl = state.client_ssl.lock().await;
        client_ssl.insert(project_id.to_string(), use_ssl);
    }

    Ok(ProjectConnectionStatus::Connected)
}

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
