use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::watch;

use russh::client;
use russh::keys::{self, PrivateKeyWithHashAlg};

pub struct SshTunnel {
    pub local_port: u16,
    shutdown_tx: watch::Sender<bool>,
}

impl SshTunnel {
    pub fn stop(&self) {
        let _ = self.shutdown_tx.send(true);
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        let _ = self.shutdown_tx.send(true);
    }
}

struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

async fn connect_ssh(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_password: Option<&str>,
    ssh_key_path: Option<&str>,
) -> Result<client::Handle<Client>, String> {
    let config = Arc::new(client::Config::default());
    let mut handle = client::connect(config, (ssh_host, ssh_port), Client)
        .await
        .map_err(|e| format!("SSH connection to {}:{} failed: {}", ssh_host, ssh_port, e))?;

    // Try key file first
    if let Some(key_path) = ssh_key_path {
        if !key_path.is_empty() {
            match keys::load_secret_key(key_path, ssh_password) {
                Ok(key) => {
                    let key = PrivateKeyWithHashAlg::new(Arc::new(key), None);
                    let result = handle
                        .authenticate_publickey(ssh_user, key)
                        .await
                        .map_err(|e| format!("SSH key auth failed: {}", e))?;
                    if result.success() {
                        return Ok(handle);
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to load SSH key {}: {}", key_path, e);
                }
            }
        }
    }

    // Then password
    if let Some(password) = ssh_password {
        if !password.is_empty() {
            let result = handle
                .authenticate_password(ssh_user, password)
                .await
                .map_err(|e| format!("SSH password auth failed: {}", e))?;
            if result.success() {
                return Ok(handle);
            }
        }
    }

    Err("SSH authentication failed: all methods exhausted".to_string())
}

pub async fn start_tunnel(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_password: Option<&str>,
    ssh_key_path: Option<&str>,
    remote_host: &str,
    remote_port: u16,
) -> Result<SshTunnel, String> {
    let handle = connect_ssh(ssh_host, ssh_port, ssh_user, ssh_password, ssh_key_path).await?;
    let handle = Arc::new(handle);

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind local port: {}", e))?;
    let local_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();

    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
    let remote_host = remote_host.to_string();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((local_stream, _)) => {
                            let handle = handle.clone();
                            let rh = remote_host.clone();
                            tokio::spawn(async move {
                                if let Err(e) = proxy(local_stream, &handle, &rh, remote_port).await {
                                    tracing::error!("SSH proxy error: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            tracing::error!("SSH tunnel accept error: {}", e);
                            break;
                        }
                    }
                }
                _ = shutdown_rx.changed() => break,
            }
        }
    });

    Ok(SshTunnel {
        local_port,
        shutdown_tx,
    })
}

async fn proxy(
    mut local: tokio::net::TcpStream,
    handle: &client::Handle<Client>,
    remote_host: &str,
    remote_port: u16,
) -> Result<(), String> {
    let channel = handle
        .channel_open_direct_tcpip(remote_host, remote_port as u32, "127.0.0.1", 0)
        .await
        .map_err(|e| {
            format!(
                "SSH direct-tcpip to {}:{} failed: {}",
                remote_host, remote_port, e
            )
        })?;

    let mut stream = channel.into_stream();
    tokio::io::copy_bidirectional(&mut local, &mut stream)
        .await
        .map_err(|e| format!("SSH proxy IO error: {}", e))?;

    Ok(())
}
