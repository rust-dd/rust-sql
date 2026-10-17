use super::{select_projects, upsert_project};
use crate::dbs::schema::create_local_schema;
use libsql::{Connection, Database};

async fn local_db() -> (Database, Connection) {
    let db = libsql::Builder::new_local(":memory:")
        .build()
        .await
        .unwrap();
    let conn = db.connect().unwrap();
    create_local_schema(&conn).await.unwrap();
    (db, conn)
}

fn details(database: &str) -> Vec<String> {
    [
        "PGSQL", "app", "secret", database, "db.local", "5432", "true", "false", "", "22", "", "",
        "",
    ]
    .map(String::from)
    .to_vec()
}

#[tokio::test]
async fn upserted_project_round_trips_its_details() {
    let (_db, conn) = local_db().await;

    upsert_project(&conn, "k1", &details("orders"))
        .await
        .unwrap();

    let projects = select_projects(&conn).await.unwrap();
    assert_eq!(projects["k1"][..13], details("orders")[..]);
}

#[tokio::test]
async fn name_follows_the_details_and_legacy_id_comes_last() {
    let (_db, conn) = local_db().await;
    let mut saved = details("orders");
    saved.push("Orders (prod)".to_string());

    upsert_project(&conn, "k1", &saved).await.unwrap();

    let project = &select_projects(&conn).await.unwrap()["k1"];
    assert_eq!(project.len(), 15);
    assert_eq!(project[13], "Orders (prod)");
    assert_eq!(project[14], "");
}

#[tokio::test]
async fn saving_an_existing_project_keeps_its_legacy_id() {
    let (_db, conn) = local_db().await;
    conn.execute(
        "INSERT INTO projects (id, name, legacy_id) VALUES ('k1', 'prod', 'prod')",
        (),
    )
    .await
    .unwrap();
    let mut saved = details("orders");
    saved.push("renamed".to_string());

    upsert_project(&conn, "k1", &saved).await.unwrap();

    let project = &select_projects(&conn).await.unwrap()["k1"];
    assert_eq!(project[13], "renamed");
    assert_eq!(project[14], "prod");
}
