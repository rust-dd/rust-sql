use std::time::SystemTime;

use chrono::DateTime;
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
      // json/jsonb can be read as String directly
      match row.try_get::<_, Option<String>>(index) {
        Ok(v) => v,
        Err(_) => Some("[json]".to_string()),
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
