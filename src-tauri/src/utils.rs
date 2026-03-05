use std::collections::HashSet;
use std::time::Instant;

use rayon::prelude::*;
use sysinfo::{Networks, Pid, ProcessRefreshKind, ProcessesToUpdate, System, get_current_pid};
use tauri::State;

use crate::AppState;

#[derive(serde::Serialize, Clone, Debug)]
pub struct SystemResourceUsage {
    pub app_cpu_percent: f32,
    pub app_memory_rss_mb: u64,
    pub app_process_count: usize,
    pub network_rx_mbps: f32,
    pub network_tx_mbps: f32,
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
                if let Some(parent) = process.parent() {
                    if included.contains(&parent) {
                        included.insert(*pid);
                        changed = true;
                    }
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
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn system_resource_usage(app_state: State<'_, AppState>) -> Result<SystemResourceUsage, String> {
    let mut monitor = app_state.resource_monitor.lock().await;
    Ok(monitor.sample())
}

const ROW_SEP: char = '\x1E';

fn parse_packed_rows(packed: &str) -> Vec<&str> {
    if packed.is_empty() {
        return Vec::new();
    }
    let parts: Vec<&str> = packed.split(ROW_SEP).collect();
    if parts.len() > 1 { parts[1..].to_vec() } else { Vec::new() }
}

fn pack_rows(header: &str, rows: &[&str]) -> String {
    if rows.is_empty() {
        return header.to_string();
    }
    let mut result = String::with_capacity(header.len() + rows.iter().map(|r| r.len() + 1).sum::<usize>());
    result.push_str(header);
    for row in rows {
        result.push(ROW_SEP);
        result.push_str(row);
    }
    result
}

/// Compute diff between two packed result sets.
/// Input: two packed strings (rows separated by \x1E, cells by \x1F).
/// First row of each is the header (columns).
/// Returns: (added_packed, removed_packed, unchanged_count)
#[tauri::command(rename_all = "snake_case")]
pub fn compute_diff(
    pinned_packed: String,
    current_packed: String,
) -> (String, String, usize) {
    let pinned_rows = parse_packed_rows(&pinned_packed);
    let current_rows = parse_packed_rows(&current_packed);

    // Build hash sets for O(1) lookup
    let pinned_set: HashSet<&str> = pinned_rows.iter().copied().collect();
    let current_set: HashSet<&str> = current_rows.iter().copied().collect();

    // Compute diff using parallel iteration for large datasets
    let (added, removed, unchanged_count) = if current_rows.len() > 5000 || pinned_rows.len() > 5000 {
        let added: Vec<&str> = current_rows.par_iter()
            .filter(|r| !pinned_set.contains(*r))
            .copied()
            .collect();
        let removed: Vec<&str> = pinned_rows.par_iter()
            .filter(|r| !current_set.contains(*r))
            .copied()
            .collect();
        let unchanged: usize = current_rows.par_iter()
            .filter(|r| pinned_set.contains(*r))
            .count();
        (added, removed, unchanged)
    } else {
        let added: Vec<&str> = current_rows.iter()
            .filter(|r| !pinned_set.contains(*r))
            .copied()
            .collect();
        let removed: Vec<&str> = pinned_rows.iter()
            .filter(|r| !current_set.contains(*r))
            .copied()
            .collect();
        let unchanged: usize = current_rows.iter()
            .filter(|r| pinned_set.contains(*r))
            .count();
        (added, removed, unchanged)
    };

    let header = pinned_packed.split(ROW_SEP).next().unwrap_or("");
    (
        pack_rows(header, &added),
        pack_rows(header, &removed),
        unchanged_count,
    )
}
