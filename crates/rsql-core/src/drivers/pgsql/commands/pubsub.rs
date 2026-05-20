use std::sync::Arc;

use crate::AppState;
use crate::drivers::pgsql::roles_schema_objects::discover_notify_channels;
use crate::error::AppError;
use crate::events::EventSink;

use futures_util::StreamExt;
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::{AsyncMessage, Config, NoTls};

use super::pool_helpers::acquire_client;

pub async fn pgsql_notify_send(
    app_state: &AppState,
    project_id: &str,
    channel: &str,
    payload: &str,
) -> Result<bool, AppError> {
    let client = acquire_client(&app_state.clients, project_id).await?;
    let sql = format!(
        "SELECT pg_notify('{}', '{}')",
        channel.replace('\'', "''"),
        payload.replace('\'', "''"),
    );
    client
        .batch_execute(&sql)
        .await
        .map_err(|e| AppError::QueryFailed(e.to_string()))?;
    Ok(true)
}

pub async fn pgsql_discover_channels(
    app_state: &AppState,
    project_id: &str,
) -> Result<Vec<String>, AppError> {
    let client = acquire_client(&app_state.meta_clients, project_id).await?;
    discover_notify_channels(&client).await
}

pub async fn listen_start<S: EventSink>(
    app_state: &AppState,
    project_id: &str,
    channel: &str,
    sink: Arc<S>,
) -> Result<bool, AppError> {
    let listen_key = format!("{project_id}:{channel}");
    {
        let handles = app_state.notify_handles.lock().await;
        if handles.contains_key(&listen_key) {
            return Ok(true);
        }
    }

    let (cfg, use_ssl) = {
        let conn = app_state
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
        let mut cfg = Config::new();
        cfg.user(row.get::<String>(0).unwrap_or_default())
            .password(row.get::<String>(1).unwrap_or_default())
            .dbname(row.get::<String>(2).unwrap_or_default())
            .host(row.get::<String>(3).unwrap_or_default())
            .port(
                row.get::<String>(4)
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or(5432),
            );
        let ssl = row.get::<String>(5).map(|s| s == "true").unwrap_or(false);
        (cfg, ssl)
    };

    let channel_owned = channel.to_string();
    let event_name = format!("pg-notify-{project_id}");
    let handle = tokio::spawn(async move {
        async fn listen_loop<Stream, TlsStream, EVT>(
            client: tokio_postgres::Client,
            mut connection: tokio_postgres::Connection<Stream, TlsStream>,
            channel: &str,
            event_name: &str,
            sink: &Arc<EVT>,
        ) where
            Stream: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
            TlsStream: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
            EVT: EventSink,
        {
            let listen_sql = format!("LISTEN \"{}\"", channel.replace('"', "\"\""));
            if let Err(e) = client.batch_execute(&listen_sql).await {
                tracing::error!("LISTEN command failed: {e:?}");
                return;
            }
            let mut stream = futures_util::stream::poll_fn(move |cx| connection.poll_message(cx));
            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(AsyncMessage::Notification(n)) => {
                        let payload = serde_json::json!({
                            "channel": n.channel(),
                            "payload": n.payload(),
                        });
                        sink.emit(event_name, &payload);
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!("LISTEN stream error: {e:?}");
                        break;
                    }
                }
            }
            drop(client);
        }

        if use_ssl {
            let tls_connector = match TlsConnector::builder().build() {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("LISTEN TLS error: {e:?}");
                    return;
                }
            };
            let tls = MakeTlsConnector::new(tls_connector);
            if let Ok((client, connection)) = cfg.connect(tls).await {
                listen_loop(client, connection, &channel_owned, &event_name, &sink).await;
            }
        } else if let Ok((client, connection)) = cfg.connect(NoTls).await {
            listen_loop(client, connection, &channel_owned, &event_name, &sink).await;
        }
    });

    app_state
        .notify_handles
        .lock()
        .await
        .insert(listen_key, handle);
    Ok(true)
}

pub async fn listen_stop(
    app_state: &AppState,
    project_id: &str,
    channel: &str,
) -> Result<bool, AppError> {
    let listen_key = format!("{project_id}:{channel}");
    if let Some(handle) = app_state.notify_handles.lock().await.remove(&listen_key) {
        handle.abort();
    }
    Ok(true)
}
