//! End-to-end checks of the row mutation path against a real PostgreSQL.
//!
//! These cover the behaviour that unit tests cannot: whether the generated
//! casts actually work for each column type, and whether a statement really
//! matches the row it was meant to. Ignored by default so `cargo test` stays
//! offline; CI runs them with `--ignored` against a service container.
//!
//! Locally:
//!   docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name rsql-test postgres:16
//!   RSQL_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
//!     cargo test --test row_mutations -- --ignored

use tokio_postgres::{Client, NoTls};

fn database_url() -> String {
    std::env::var("RSQL_TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/postgres".to_string())
}

async fn connect() -> Client {
    let (client, connection) = tokio_postgres::connect(&database_url(), NoTls)
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
async fn setup(client: &Client, table: &str, columns: &str) {
    client
        .batch_execute(&format!(
            "DROP TABLE IF EXISTS {table}; CREATE TABLE {table} ({columns});"
        ))
        .await
        .expect("create the test table");
}

/// Mirrors what `pgsql_apply_row_mutations` does, minus the Tauri state: build
/// the statements, run them in one transaction, require exactly one row each.
async fn apply(
    client: &mut Client,
    statements: &[(String, Vec<Option<String>>)],
) -> Result<usize, String> {
    let tx = client.transaction().await.map_err(|e| e.to_string())?;
    let mut applied = 0;

    for (sql, params) in statements {
        let bound: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
            .iter()
            .map(|p| p as &(dyn tokio_postgres::types::ToSql + Sync))
            .collect();
        let affected = tx
            .execute(sql.as_str(), &bound)
            .await
            .map_err(|e| e.to_string())?;
        if affected != 1 {
            return Err(format!("expected 1 row, matched {affected}"));
        }
        applied += 1;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(applied)
}

fn some(value: &str) -> Option<String> {
    Some(value.to_string())
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn deletes_the_row_whose_key_is_the_text_null_not_the_null_row() {
    let mut client = connect().await;
    setup(
        &client,
        "rsql_test_text_null",
        "id text primary key, note text",
    )
    .await;
    client
        .batch_execute(
            "INSERT INTO rsql_test_text_null VALUES ('null', 'the text null'), ('other', 'x')",
        )
        .await
        .unwrap();

    let statements = vec![(
        "DELETE FROM \"public\".\"rsql_test_text_null\" WHERE \"id\" = $1::text::text".to_string(),
        vec![some("null")],
    )];
    apply(&mut client, &statements)
        .await
        .expect("delete applies");

    let remaining: Vec<String> = client
        .query("SELECT id FROM rsql_test_text_null ORDER BY id", &[])
        .await
        .unwrap()
        .iter()
        .map(|r| r.get(0))
        .collect();
    assert_eq!(remaining, vec!["other".to_string()]);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn a_null_key_matches_only_the_null_row() {
    let mut client = connect().await;
    setup(
        &client,
        "rsql_test_null_key",
        "id int, tag text, PRIMARY KEY (id)",
    )
    .await;
    client
        .batch_execute("INSERT INTO rsql_test_null_key VALUES (1, NULL), (2, 'null'), (3, '')")
        .await
        .unwrap();

    let statements = vec![(
        "DELETE FROM \"public\".\"rsql_test_null_key\" WHERE \"tag\" IS NULL".to_string(),
        vec![],
    )];
    apply(&mut client, &statements)
        .await
        .expect("delete applies");

    let remaining: Vec<i32> = client
        .query("SELECT id FROM rsql_test_null_key ORDER BY id", &[])
        .await
        .unwrap()
        .iter()
        .map(|r| r.get(0))
        .collect();
    assert_eq!(remaining, vec![2, 3]);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn a_delete_matching_no_rows_is_an_error_and_rolls_back() {
    let mut client = connect().await;
    setup(&client, "rsql_test_missing", "id int primary key").await;
    client
        .batch_execute("INSERT INTO rsql_test_missing VALUES (1), (2)")
        .await
        .unwrap();

    let statements = vec![
        (
            "DELETE FROM \"public\".\"rsql_test_missing\" WHERE \"id\" = $1::text::int4"
                .to_string(),
            vec![some("1")],
        ),
        (
            "DELETE FROM \"public\".\"rsql_test_missing\" WHERE \"id\" = $1::text::int4"
                .to_string(),
            vec![some("99")],
        ),
    ];
    let err = apply(&mut client, &statements).await.unwrap_err();
    assert!(err.contains("matched 0"), "unexpected error: {err}");

    // The first delete must have rolled back with the second.
    let count: i64 = client
        .query_one("SELECT count(*) FROM rsql_test_missing", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 2);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn a_key_matching_several_rows_is_an_error_and_rolls_back() {
    let mut client = connect().await;
    setup(&client, "rsql_test_dupes", "id int, tag text").await;
    client
        .batch_execute("INSERT INTO rsql_test_dupes VALUES (1, 'a'), (1, 'b')")
        .await
        .unwrap();

    let statements = vec![(
        "DELETE FROM \"public\".\"rsql_test_dupes\" WHERE \"id\" = $1::text::int4".to_string(),
        vec![some("1")],
    )];
    let err = apply(&mut client, &statements).await.unwrap_err();
    assert!(err.contains("matched 2"), "unexpected error: {err}");

    let count: i64 = client
        .query_one("SELECT count(*) FROM rsql_test_dupes", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 2);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn updates_and_deletes_apply_together_in_one_transaction() {
    let mut client = connect().await;
    setup(&client, "rsql_test_mixed", "id int primary key, tag text").await;
    client
        .batch_execute("INSERT INTO rsql_test_mixed VALUES (1, 'a'), (2, 'b'), (3, 'c')")
        .await
        .unwrap();

    let statements = vec![
        (
            "UPDATE \"public\".\"rsql_test_mixed\" SET \"tag\" = $1::text::text \
             WHERE \"id\" = $2::text::int4"
                .to_string(),
            vec![some("updated"), some("1")],
        ),
        (
            "DELETE FROM \"public\".\"rsql_test_mixed\" WHERE \"id\" = $1::text::int4".to_string(),
            vec![some("2")],
        ),
    ];
    assert_eq!(apply(&mut client, &statements).await.unwrap(), 2);

    let rows = client
        .query("SELECT id, tag FROM rsql_test_mixed ORDER BY id", &[])
        .await
        .unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].get::<_, String>(1), "updated");
    assert_eq!(rows[1].get::<_, i32>(0), 3);
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn an_update_can_write_a_real_null_over_the_text_null() {
    let mut client = connect().await;
    setup(
        &client,
        "rsql_test_set_null",
        "id int primary key, tag text",
    )
    .await;
    client
        .batch_execute("INSERT INTO rsql_test_set_null VALUES (1, 'null')")
        .await
        .unwrap();

    let statements = vec![(
        "UPDATE \"public\".\"rsql_test_set_null\" SET \"tag\" = $1::text::text \
         WHERE \"id\" = $2::text::int4"
            .to_string(),
        vec![None, some("1")],
    )];
    apply(&mut client, &statements).await.unwrap();

    let tag: Option<String> = client
        .query_one("SELECT tag FROM rsql_test_set_null WHERE id = 1", &[])
        .await
        .unwrap()
        .get(0);
    assert!(tag.is_none());
}

#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn composite_keys_target_exactly_one_row() {
    let mut client = connect().await;
    setup(
        &client,
        "rsql_test_composite",
        "tenant text, id int, tag text, PRIMARY KEY (tenant, id)",
    )
    .await;
    client
        .batch_execute(
            "INSERT INTO rsql_test_composite VALUES ('a', 1, 'x'), ('b', 1, 'y'), ('a', 2, 'z')",
        )
        .await
        .unwrap();

    let statements = vec![(
        "DELETE FROM \"public\".\"rsql_test_composite\" \
         WHERE \"tenant\" = $1::text::text AND \"id\" = $2::text::int4"
            .to_string(),
        vec![some("a"), some("1")],
    )];
    apply(&mut client, &statements).await.unwrap();

    let count: i64 = client
        .query_one("SELECT count(*) FROM rsql_test_composite", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 2);
}

/// The `$n::text::<type>` recipe has to hold for more than the obvious types.
#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn the_cast_recipe_works_across_column_types() {
    let mut client = connect().await;
    client
        .batch_execute(
            "DROP TABLE IF EXISTS rsql_test_types;
             DROP TYPE IF EXISTS rsql_test_mood;
             CREATE TYPE rsql_test_mood AS ENUM ('ok', 'bad');
             CREATE TABLE rsql_test_types (
                 id bigint primary key,
                 amount numeric(10,2),
                 when_ timestamptz,
                 tags text[],
                 doc jsonb,
                 mood rsql_test_mood,
                 raw bytea,
                 flag boolean,
                 uid uuid
             );",
        )
        .await
        .unwrap();
    client
        .batch_execute("INSERT INTO rsql_test_types (id) VALUES (1)")
        .await
        .unwrap();

    let statements = vec![(
        "UPDATE \"public\".\"rsql_test_types\" SET \
         \"amount\" = $1::text::numeric(10,2), \
         \"when_\" = $2::text::timestamp with time zone, \
         \"tags\" = $3::text::text[], \
         \"doc\" = $4::text::jsonb, \
         \"mood\" = $5::text::rsql_test_mood, \
         \"raw\" = $6::text::bytea, \
         \"flag\" = $7::text::boolean, \
         \"uid\" = $8::text::uuid \
         WHERE \"id\" = $9::text::int8"
            .to_string(),
        vec![
            some("12.34"),
            some("2026-08-10 12:00:00+00"),
            some("{a,b}"),
            some("{\"k\": 1}"),
            some("bad"),
            some("\\x deadbeef".replace(' ', "").as_str()),
            some("true"),
            some("00000000-0000-0000-0000-000000000001"),
            some("1"),
        ],
    )];
    apply(&mut client, &statements)
        .await
        .expect("every cast should be accepted");

    let amount: String = client
        .query_one("SELECT amount::text FROM rsql_test_types WHERE id = 1", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(amount, "12.34");
}

/// Values holding the wire separators must round-trip as key material.
#[tokio::test]
#[ignore = "requires a PostgreSQL server"]
async fn control_characters_in_a_key_still_match_their_row() {
    let mut client = connect().await;
    setup(&client, "rsql_test_control", "id text primary key").await;

    let awkward = "a\u{1F}b\u{1E}c\u{1D}d";
    client
        .execute("INSERT INTO rsql_test_control VALUES ($1)", &[&awkward])
        .await
        .unwrap();

    let statements = vec![(
        "DELETE FROM \"public\".\"rsql_test_control\" WHERE \"id\" = $1::text::text".to_string(),
        vec![some(awkward)],
    )];
    apply(&mut client, &statements)
        .await
        .expect("a key with control characters should still match");

    let count: i64 = client
        .query_one("SELECT count(*) FROM rsql_test_control", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}
