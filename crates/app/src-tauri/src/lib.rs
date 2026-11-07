//! Tauri window layer for SOCDOF.
//!
//! This crate only wires the webview to [`socdof_app::desktop::DesktopState`]. The startup sequence,
//! instance lock, SQLite access and backup format stay in `socdof-app` and `socdof-core`.

#![deny(missing_docs)]

pub mod commands;

use socdof_app::desktop::DesktopState;
use tauri::Manager;

/// Starts the SOCDOF desktop window.
///
/// The application data directory is created before the state is opened, so the database and its
/// instance lock always live in a writable location. Returns when the last window closes.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(DesktopState::open(data_dir.join("socdof.db"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::database_status,
            commands::create_backup,
            commands::smoke_enabled,
            commands::finish_smoke,
            commands::abort_smoke
        ])
        .run(tauri::generate_context!())
        .expect("SOCDOF window failed to start");
}
