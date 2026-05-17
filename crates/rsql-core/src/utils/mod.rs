use std::collections::HashSet;
use std::time::Instant;

use sysinfo::{Networks, Pid, ProcessRefreshKind, ProcessesToUpdate, System, get_current_pid};

pub mod diff;

#[derive(serde::Serialize, Clone, Debug)]
pub struct SystemResourceUsage {
    pub app_cpu_percent: f32,
    pub app_memory_rss_mb: u64,
    pub app_process_count: usize,
    pub network_rx_mbps: f32,
    pub network_tx_mbps: f32,
    pub db_connections_in_use: usize,
    pub db_connections_open: usize,
    pub db_connections_max: usize,
    pub db_connections_waiting: usize,
}

pub struct ResourceMonitor {
    system: System,
    networks: Networks,
    last_sample_at: Instant,
    app_pid: Pid,
}

impl ResourceMonitor {
    pub fn new() -> Self {
        let app_pid = get_current_pid().unwrap_or_else(|_| Pid::from_u32(std::process::id()));
        let mut system = System::new_all();
        system.refresh_processes(ProcessesToUpdate::All, true);
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);

        Self {
            system,
            networks,
            last_sample_at: Instant::now(),
            app_pid,
        }
    }

    pub fn sample(&mut self) -> SystemResourceUsage {
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
        self.networks.refresh(true);
        let dt = self.last_sample_at.elapsed().as_secs_f32().max(0.001);
        self.last_sample_at = Instant::now();

        let processes = self.system.processes();
        let mut included = HashSet::new();
        included.insert(self.app_pid);

        let mut changed = true;
        while changed {
            changed = false;
            for (pid, process) in processes {
                if included.contains(pid) {
                    continue;
                }
                if let Some(parent) = process.parent()
                    && included.contains(&parent)
                {
                    included.insert(*pid);
                    changed = true;
                }
            }
        }

        let mut total_cpu = 0.0f32;
        let mut total_rss = 0u64;
        for pid in &included {
            if let Some(process) = processes.get(pid) {
                total_cpu += process.cpu_usage();
                total_rss = total_rss.saturating_add(process.memory());
            }
        }

        let mut rx_bytes: u64 = 0;
        let mut tx_bytes: u64 = 0;
        for (_iface, net) in &self.networks {
            rx_bytes = rx_bytes.saturating_add(net.received());
            tx_bytes = tx_bytes.saturating_add(net.transmitted());
        }
        let network_rx_mbps = (rx_bytes as f32 * 8.0) / dt / 1_000_000.0;
        let network_tx_mbps = (tx_bytes as f32 * 8.0) / dt / 1_000_000.0;

        SystemResourceUsage {
            app_cpu_percent: total_cpu,
            app_memory_rss_mb: total_rss / (1024 * 1024),
            app_process_count: included.len(),
            network_rx_mbps,
            network_tx_mbps,
            db_connections_in_use: 0,
            db_connections_open: 0,
            db_connections_max: 0,
            db_connections_waiting: 0,
        }
    }
}

impl Default for ResourceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Aggregate pool-stats from a deadpool pool map.
/// Returns (open, available, max, waiting).
pub async fn pool_stats(
    pools: &tokio::sync::Mutex<
        std::collections::BTreeMap<String, std::sync::Arc<deadpool_postgres::Pool>>,
    >,
) -> (usize, usize, usize, usize) {
    let clients = pools.lock().await;
    let mut open = 0usize;
    let mut available = 0usize;
    let mut max = 0usize;
    let mut waiting = 0usize;
    for pool in clients.values() {
        let status = pool.status();
        open = open.saturating_add(status.size);
        available = available.saturating_add(status.available);
        max = max.saturating_add(status.max_size);
        waiting = waiting.saturating_add(status.waiting);
    }
    (open, available, max, waiting)
}
