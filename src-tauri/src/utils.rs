use std::path::Path;

use tokio_postgres::Row;

pub fn create_or_open_local_db(path: &str, app_dir: &Path) -> sled::Db {
  if cfg!(debug_assertions) {
    let db = sled::open(path).unwrap();
    return db;
  }

  let db_path = app_dir.join(path);
  sled::open(db_path).unwrap()
}

/// The postgres-crate does not provide a default mapping to fallback to String for all
/// types: row.get is generic and without a type assignment the FromSql-Trait cannot be inferred.
/// This function matches over the current column-type and does a manual conversion
pub fn reflective_get(row: &Row, index: usize) -> String {
  let column_type = row.columns().get(index).map(|c| c.type_().name()).unwrap();
  // see https://docs.rs/sqlx/0.4.0-beta.1/sqlx/postgres/types/index.html

  let value = match column_type {
    "bool" => {
      let v = row.get::<_, Option<bool>>(index);
      v.map(|v| v.to_string())
    }
    "varchar" | "char(n)" | "text" | "name" => row.get(index),
    // "char" => {
    //     let v: i8 = row.get(index);
    // }
    "int2" | "smallserial" | "smallint" => {
      let v = row.get::<_, Option<i16>>(index);
      v.map(|v| v.to_string())
    }
    "int" | "int4" | "serial" => {
      let v = row.get::<_, Option<i32>>(index);
      v.map(|v| v.to_string())
    }
    "int8" | "bigserial" | "bigint" => {
      let v = row.get::<_, Option<i64>>(index);
      v.map(|v| v.to_string())
    }
    "float4" | "real" => {
      let v = row.get::<_, Option<f32>>(index);
      v.map(|v| v.to_string())
    }
    "float8" | "double precision" => {
      let v = row.get::<_, Option<f64>>(index);
      v.map(|v| v.to_string())
    }
    // "timestamp" | "timestamptz" => {
    //     // with-chrono feature is needed for this
    //     let v: Option<chrono::DateTime<chrono::Utc>> = row.get(index);
    //     v.map(|v| v.to_string())
    // }
    &_ => Some("CANNOT PARSE".to_string()),
  };
  value.unwrap_or("null".to_string())
}
