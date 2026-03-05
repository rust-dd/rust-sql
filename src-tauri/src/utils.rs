use std::collections::HashSet;
use std::time::SystemTime;

use chrono::DateTime;
use rayon::prelude::*;
use tokio_postgres::Row;

/// Convert a PostgreSQL row value at `index` to a String representation.
/// Handles NULL values safely and supports common PostgreSQL types.
pub fn reflective_get(row: &Row, index: usize) -> String {
  let column_type = match row.columns().get(index) {
    Some(c) => c.type_().name(),
    None => return "null".to_string(),
  };

  let value: Option<String> = match column_type {
    "bool" => row.get::<_, Option<bool>>(index).map(|v| v.to_string()),
    "varchar" | "char(n)" | "text" | "name" | "bpchar" | "citext" => row.get(index),
    "char" => {
      let v: Option<i8> = row.get(index);
      v.map(|v| v.to_string())
    }
    "smallserial" | "smallint" | "int2" => {
      row.get::<_, Option<i16>>(index).map(|v| v.to_string())
    }
    "int" | "int4" | "serial" | "oid" => {
      row.get::<_, Option<i32>>(index).map(|v| v.to_string())
    }
    "int8" | "bigserial" | "bigint" => {
      row.get::<_, Option<i64>>(index).map(|v| v.to_string())
    }
    "float4" | "real" => {
      row.get::<_, Option<f32>>(index).map(|v| v.to_string())
    }
    "float8" | "double precision" => {
      row.get::<_, Option<f64>>(index).map(|v| v.to_string())
    }
    "numeric" | "decimal" => {
      // numeric is not directly supported without the rust_decimal feature,
      // fallback to string representation
      row.get::<_, Option<String>>(index)
    }
    "timestamp" | "timestamptz" => {
      let v: Option<SystemTime> = row.get(index);
      v.map(|t| DateTime::<chrono::Utc>::from(t).to_string())
    }
    "date" => {
      let v: Option<SystemTime> = row.get(index);
      v.map(|t| DateTime::<chrono::Utc>::from(t).format("%Y-%m-%d").to_string())
    }
    "time" | "timetz" => {
      // time types don't map directly to SystemTime, fall back to string
      row.get::<_, Option<String>>(index)
    }
    "interval" => {
      row.get::<_, Option<String>>(index)
    }
    "uuid" => {
      row.get::<_, Option<String>>(index)
    }
    "json" | "jsonb" => {
      // Use serde_json::Value for reliable json/jsonb extraction, sonic-rs for fast serialization
      match row.try_get::<_, Option<serde_json::Value>>(index) {
        Ok(Some(v)) => Some(sonic_rs::to_string(&v).unwrap_or_else(|_| v.to_string())),
        Ok(None) => None,
        Err(_) => {
          // Fallback: try as string
          match row.try_get::<_, Option<String>>(index) {
            Ok(v) => v,
            Err(_) => Some("[json]".to_string()),
          }
        }
      }
    }
    "bytea" => Some("[binary data]".to_string()),
    "inet" | "cidr" | "macaddr" | "macaddr8" => {
      row.get::<_, Option<String>>(index)
    }
    _ => {
      // Try to get as string, fallback to unsupported message
      match row.try_get::<_, Option<String>>(index) {
        Ok(v) => v,
        Err(_) => Some(format!("[unsupported: {}]", column_type)),
      }
    }
  };
  value.unwrap_or_else(|| "null".to_string())
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
