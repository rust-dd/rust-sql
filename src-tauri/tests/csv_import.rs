//! CSV import against a real PostgreSQL.
//!
//! CSV fields are text. Binding them directly at a typed column made
//! tokio-postgres refuse to serialize the parameter, so importing into any
//! table with a numeric, date or boolean column failed outright. These check
//! the cast recipe that replaced it, and that an empty field lands as NULL.
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

/// Each test gets its own table so they can run concurrently.
async fn setup(client: &Client, table: &str) {
    client
        .batch_execute(&format!(
            "DROP TABLE IF EXISTS {table};
             CREATE TABLE {table} (
                 id int, amount numeric(10,2), born date, ok boolean, note text
             );"
        ))
        .await
        .expect("create the test table");
}

fn insert_sql(table: &str) -> String {
    format!(
        "INSERT INTO \"public\".\"{table}\" \
         (\"id\", \"amount\", \"born\", \"ok\", \"note\") VALUES \
         ($1::text::integer, $2::text::numeric(10,2), $3::text::date, \
          $4::text::boolean, $5::text::text)"
    )
}

async fn insert(client: &Client, table: &str, values: &[Option<String>]) -> Result<u64, String> {
    let statement = client
        .prepare(&insert_sql(table))
        .await
        .map_err(|e| e.to_string())?;
    let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = values
        .iter()
        .map(|v| v as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();
    client.execute(&statement, &params).await.map_err(|e| {
        // Mirrors the app's error_chain: the message Postgres sent lives in
        // the source, not in the top-level "db error".
        let mut msg = e.to_string();
        let mut src = std::error::Error::source(&e);
        while let Some(cause) = src {
            msg.push_str(": ");
            msg.push_str(&cause.to_string());
            src = cause.source();
        }
        msg
    })
}

fn some(value: &str) -> Option<String> {
    Some(value.to_string())
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn text_fields_import_into_typed_columns() {
    let client = connect().await;
    setup(&client, "rsql_csv_typed").await;

    insert(
        &client,
        "rsql_csv_typed",
        &[
            some("1"),
            some("9.50"),
            some("2020-01-02"),
            some("true"),
            some("a note"),
        ],
    )
    .await
    .expect("a typed row should import");

    let amount: String = client
        .query_one("SELECT amount::text FROM rsql_csv_typed WHERE id = 1", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(amount, "9.50");
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn empty_fields_become_null_not_empty_strings() {
    let client = connect().await;
    setup(&client, "rsql_csv_empty").await;

    insert(
        &client,
        "rsql_csv_empty",
        &[some("2"), None, None, None, None],
    )
    .await
    .expect("a row of empty fields should import");

    let nulls: i64 = client
        .query_one(
            "SELECT count(*) FROM rsql_csv_empty
             WHERE amount IS NULL AND born IS NULL AND ok IS NULL AND note IS NULL",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(nulls, 1);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn a_malformed_field_fails_that_row_rather_than_importing_garbage() {
    let client = connect().await;
    setup(&client, "rsql_csv_bad").await;

    let err = insert(
        &client,
        "rsql_csv_bad",
        &[some("3"), some("not a number"), None, None, None],
    )
    .await
    .unwrap_err();
    assert!(err.contains("invalid input syntax"), "unexpected: {err}");
}
