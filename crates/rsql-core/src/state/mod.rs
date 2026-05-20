pub mod bootstrap;
pub mod project;
pub mod query;
pub mod workspace;

pub use bootstrap::bootstrap;

use deadpool_postgres::Pool;
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use tokio_postgres::CancelToken;

use crate::drivers::pgsql::VirtualCache;
use crate::ssh::SshTunnel;
use crate::utils::ResourceMonitor;

pub struct AppState {
    pub clients: Arc<Mutex<BTreeMap<String, Arc<Pool>>>>,
    pub meta_clients: Arc<Mutex<BTreeMap<String, Arc<Pool>>>>,
    pub cancel_tokens: Arc<Mutex<BTreeMap<String, CancelToken>>>,
    pub client_ssl: Arc<Mutex<BTreeMap<String, bool>>>,
    pub local_db: libsql::Database,
    pub resource_monitor: Arc<Mutex<ResourceMonitor>>,
    pub virtual_cache: Arc<Mutex<VirtualCache>>,
    pub notify_handles: Arc<Mutex<BTreeMap<String, tokio::task::JoinHandle<()>>>>,
    pub ssh_tunnels: Arc<Mutex<BTreeMap<String, SshTunnel>>>,
}
