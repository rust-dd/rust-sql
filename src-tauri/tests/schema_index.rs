//! Schema index against a real PostgreSQL.
//!
//! The catalog queries are hand-written and join several system tables, so what
//! matters is not that they parse but that they report the right kind, type,
//! nullability, primary key and foreign key for real objects.
//!
//! Ignored by default; see tests/row_mutations.rs for how to run them.

use tokio_postgres::{Client, NoTls};

async fn connect() -> Client {
    let url = std::env::var("RSQL_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/postgres".to_string());
    let (client, connection) = tokio_postgres::connect(&url, NoTls)
        .await
        .expect("connect to the test database");
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {e}");
        }
    });
    client
}

const RELATION_SQL: &str = include_str!("../src/drivers/pgsql/sql/relations.sql");
const COLUMN_SQL: &str = include_str!("../src/drivers/pgsql/sql/columns.sql");
const FUNCTION_SQL: &str = include_str!("../src/drivers/pgsql/sql/functions.sql");

async fn setup(client: &Client, schema: &str) {
    client
        .batch_execute(&format!(
            "DROP SCHEMA IF EXISTS {schema} CASCADE;
             CREATE SCHEMA {schema};
             CREATE TABLE {schema}.parent (id bigint PRIMARY KEY, label text NOT NULL);
             CREATE TABLE {schema}.child (
                 id int PRIMARY KEY,
                 parent_id bigint REFERENCES {schema}.parent(id),
                 note text,
                 amount numeric(10,2) DEFAULT 0
             );
             CREATE VIEW {schema}.child_view AS SELECT id, note FROM {schema}.child;
             CREATE MATERIALIZED VIEW {schema}.child_mv AS SELECT id FROM {schema}.child;
             CREATE INDEX child_note_idx ON {schema}.child (note);
             CREATE SEQUENCE {schema}.some_seq;
             CREATE FUNCTION {schema}.add_one(n integer) RETURNS integer
                 LANGUAGE sql AS 'SELECT n + 1';
             COMMENT ON TABLE {schema}.parent IS 'a parent table';"
        ))
        .await
        .expect("create the test schema");
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn relations_report_their_kind_and_exclude_indexes_and_sequences() {
    let client = connect().await;
    setup(&client, "rsql_idx_kinds").await;

    let rows = client
        .query(RELATION_SQL, &[&"rsql_idx_kinds"])
        .await
        .unwrap();
    let found: Vec<(String, String)> = rows
        .iter()
        .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1)))
        .collect();

    assert_eq!(
        found,
        vec![
            ("child".to_string(), "r".to_string()),
            ("child_mv".to_string(), "m".to_string()),
            ("child_view".to_string(), "v".to_string()),
            ("parent".to_string(), "r".to_string()),
        ]
    );
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn a_table_comment_is_reported() {
    let client = connect().await;
    setup(&client, "rsql_idx_comment").await;

    let rows = client
        .query(RELATION_SQL, &[&"rsql_idx_comment"])
        .await
        .unwrap();
    let parent = rows
        .iter()
        .find(|r| r.get::<_, String>(0) == "parent")
        .unwrap();
    assert_eq!(
        parent.get::<_, Option<String>>(2).as_deref(),
        Some("a parent table")
    );
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn columns_report_type_nullability_default_and_keys() {
    let client = connect().await;
    setup(&client, "rsql_idx_columns").await;

    let rows = client
        .query(COLUMN_SQL, &[&"rsql_idx_columns", &5001i64])
        .await
        .unwrap();

    let child: Vec<_> = rows
        .iter()
        .filter(|r| r.get::<_, String>(0) == "child")
        .collect();

    let id = child
        .iter()
        .find(|r| r.get::<_, String>(1) == "id")
        .unwrap();
    assert_eq!(id.get::<_, String>(2), "integer");
    assert!(!id.get::<_, bool>(3), "a primary key is not nullable");
    assert!(id.get::<_, bool>(5), "id should be flagged as primary key");

    let note = child
        .iter()
        .find(|r| r.get::<_, String>(1) == "note")
        .unwrap();
    assert!(note.get::<_, bool>(3), "note is nullable");
    assert!(!note.get::<_, bool>(5));

    let amount = child
        .iter()
        .find(|r| r.get::<_, String>(1) == "amount")
        .unwrap();
    assert_eq!(amount.get::<_, String>(2), "numeric(10,2)");
    assert!(
        amount.get::<_, Option<String>>(4).is_some(),
        "has a default"
    );

    let parent_id = child
        .iter()
        .find(|r| r.get::<_, String>(1) == "parent_id")
        .unwrap();
    assert_eq!(
        (
            parent_id.get::<_, Option<String>>(6),
            parent_id.get::<_, Option<String>>(7),
            parent_id.get::<_, Option<String>>(8),
        ),
        (
            Some("rsql_idx_columns".to_string()),
            Some("parent".to_string()),
            Some("id".to_string()),
        )
    );
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn view_columns_are_indexed_too() {
    let client = connect().await;
    setup(&client, "rsql_idx_views").await;

    let rows = client
        .query(COLUMN_SQL, &[&"rsql_idx_views", &5001i64])
        .await
        .unwrap();
    let view_columns: Vec<String> = rows
        .iter()
        .filter(|r| r.get::<_, String>(0) == "child_view")
        .map(|r| r.get::<_, String>(1))
        .collect();
    assert_eq!(view_columns, vec!["id".to_string(), "note".to_string()]);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn the_column_limit_is_what_signals_truncation() {
    let client = connect().await;
    setup(&client, "rsql_idx_limit").await;

    // A cap of 2 must come back with 3 rows so the caller can tell it overflowed.
    let rows = client
        .query(COLUMN_SQL, &[&"rsql_idx_limit", &3i64])
        .await
        .unwrap();
    assert_eq!(rows.len(), 3);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn functions_report_their_signature_and_return_type() {
    let client = connect().await;
    setup(&client, "rsql_idx_funcs").await;

    let rows = client
        .query(FUNCTION_SQL, &[&"rsql_idx_funcs"])
        .await
        .unwrap();
    let add_one = rows
        .iter()
        .find(|r| r.get::<_, String>(0) == "add_one")
        .expect("the function should be indexed");
    assert_eq!(add_one.get::<_, String>(1), "n integer");
    assert_eq!(add_one.get::<_, String>(2), "integer");
}
