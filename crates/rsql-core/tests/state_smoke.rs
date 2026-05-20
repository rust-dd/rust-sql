use rsql_core::state::project;

#[tokio::test]
async fn project_roundtrip() {
    // Use a temp file path rather than ":memory:" because libsql's in-memory
    // databases are scoped per-connection, and the project_* helpers open
    // their own connections internally.
    let tmp_dir = std::env::temp_dir();
    let db_path = tmp_dir.join(format!("rsql_core_state_smoke_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&db_path);

    let db = libsql::Builder::new_local(&db_path)
        .build()
        .await
        .expect("open db");

    let conn = db.connect().expect("connect");
    conn.execute(
        "CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            driver TEXT NOT NULL DEFAULT 'PGSQL',
            username TEXT NOT NULL DEFAULT '',
            password TEXT NOT NULL DEFAULT '',
            database TEXT NOT NULL DEFAULT '',
            host TEXT NOT NULL DEFAULT '',
            port TEXT NOT NULL DEFAULT '',
            ssl TEXT NOT NULL DEFAULT 'false',
            ssh_enabled TEXT NOT NULL DEFAULT '',
            ssh_host TEXT NOT NULL DEFAULT '',
            ssh_port TEXT NOT NULL DEFAULT '',
            ssh_user TEXT NOT NULL DEFAULT '',
            ssh_password TEXT NOT NULL DEFAULT '',
            ssh_key_path TEXT NOT NULL DEFAULT ''
        )",
        (),
    )
    .await
    .expect("create projects table");

    conn.execute(
        "CREATE TABLE virtual_query_snapshots (
            query_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            sql TEXT NOT NULL,
            columns_packed TEXT NOT NULL DEFAULT '',
            total_rows INTEGER NOT NULL DEFAULT 0,
            page_size INTEGER NOT NULL DEFAULT 0,
            col_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        (),
    )
    .await
    .expect("create snapshots table");
    conn.execute(
        "CREATE TABLE virtual_query_pages (
            query_id TEXT NOT NULL,
            page_index INTEGER NOT NULL,
            packed_page TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (query_id, page_index)
        )",
        (),
    )
    .await
    .expect("create pages table");

    let details = vec![
        "PGSQL".to_string(),
        "user".to_string(),
        "pass".to_string(),
        "db".to_string(),
        "localhost".to_string(),
        "5432".to_string(),
        "false".to_string(),
        String::new(),
        String::new(),
        String::new(),
        String::new(),
        String::new(),
        String::new(),
    ];

    project::project_db_insert(&db, "p1", details.clone())
        .await
        .expect("insert");

    let projects = project::project_db_select(&db).await.expect("select");
    assert_eq!(projects.len(), 1);
    assert!(projects.contains_key("p1"));

    project::project_db_delete(&db, "p1").await.expect("delete");

    let projects = project::project_db_select(&db)
        .await
        .expect("select after delete");
    assert_eq!(projects.len(), 0);

    drop(conn);
    drop(db);
    let _ = std::fs::remove_file(&db_path);
}

#[tokio::test]
async fn bootstrap_creates_tables() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let path = tmp.path().to_string_lossy().to_string();
    let state = rsql_core::state::bootstrap(&path)
        .await
        .expect("bootstrap should succeed");

    let conn = state.local_db.connect().unwrap();
    let mut rows = conn
        .query(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            (),
        )
        .await
        .unwrap();

    let mut names = Vec::new();
    while let Some(row) = rows.next().await.unwrap() {
        names.push(row.get::<String>(0).unwrap());
    }

    for required in [
        "projects",
        "queries",
        "workspaces",
        "virtual_query_snapshots",
        "virtual_query_pages",
    ] {
        assert!(
            names.contains(&required.to_string()),
            "missing table: {required}"
        );
    }
}
