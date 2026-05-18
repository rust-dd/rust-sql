use tauri::Manager;
use tauri::menu::{AboutMetadata, MenuBuilder, SubmenuBuilder};

use crate::LOCAL_DB_NAME;

pub fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(desktop)]
    if let Some(pubkey) = option_env!("TAURI_UPDATER_PUBLIC_KEY") {
        app.handle()
            .plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build())?;
    } else {
        tracing::info!(
            "Updater disabled because TAURI_UPDATER_PUBLIC_KEY was not set at build time"
        );
    }

    let app_handle = app.handle().clone();

    tauri::async_runtime::block_on(async move {
        let db_path = if cfg!(debug_assertions) {
            LOCAL_DB_NAME.to_string()
        } else {
            let app_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_dir).ok();
            app_dir.join(LOCAL_DB_NAME).to_string_lossy().to_string()
        };

        let state = rsql_core::state::bootstrap(&db_path)
            .await
            .expect("AppState bootstrap failed");
        app_handle.manage(state);

        let terminal_state = rsql_core::terminal::TerminalRegistry::new();
        app_handle.manage(terminal_state);
    });

    let handle = app.handle();

    let app_menu = SubmenuBuilder::new(handle, "RSQL")
        .about(Some(AboutMetadata {
            name: Some("RSQL".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            copyright: Some("\u{00a9} 2025 rust-dd".into()),
            comments: Some(
                "Modern SQL client for PostgreSQL.\nBuilt with Tauri, React, and Rust.".into(),
            ),
            website: Some("https://github.com/rust-dd/rust-sql".into()),
            website_label: Some("GitHub".into()),
            ..Default::default()
        }))
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, "View").fullscreen().build()?;

    let window_menu = SubmenuBuilder::new(handle, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(handle)
        .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
        .build()?;

    handle.set_menu(menu)?;

    #[cfg(debug_assertions)]
    {
        let window = app
            .get_webview_window("main")
            .expect("main window not found");
        window.open_devtools();
        window.close_devtools();
    }

    Ok(())
}
