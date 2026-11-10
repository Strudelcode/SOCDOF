//! Tauri window layer for SOCDOF.
//!
//! This crate only wires the webview to [`socdof_app::desktop::DesktopState`]. The startup sequence,
//! instance lock, SQLite access and backup format stay in `socdof-app` and `socdof-core`.
//!
//! Window geometry persistence lives in [`socdof_app::window_state`]; this layer only converts
//! between the window's physical pixels and that module, so the restore/clamp rules are tested
//! without GTK.

#![deny(missing_docs)]

pub mod commands;

use socdof_app::desktop::DesktopState;
use socdof_app::window_state::{self, ScreenBounds, WindowGeometry};
use tauri::{Manager, PhysicalPosition, PhysicalSize, Window, WindowEvent};

/// Whether the process runs the CI smoke contract (`SOCDOF_SMOKE_REPORT` set).
fn smoke_mode() -> bool {
    std::env::var_os("SOCDOF_SMOKE_REPORT").is_some()
}

/// Reads the current geometry of `window`, in physical pixels.
fn geometry_of(window: &Window) -> Option<WindowGeometry> {
    let size = window.inner_size().ok()?;
    let position = window.outer_position().ok()?;
    Some(WindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: window.is_maximized().unwrap_or(false),
        fullscreen: window.is_fullscreen().unwrap_or(false),
    })
}

/// Rectangle of the monitor the window currently sits on.
fn screen_of(window: &Window) -> ScreenBounds {
    match window.current_monitor() {
        Ok(Some(monitor)) => ScreenBounds {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        },
        _ => ScreenBounds::default(),
    }
}

/// Applies a stored geometry to the window.
fn apply(window: &Window, geometry: &WindowGeometry) {
    let _ = window.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = window.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    if geometry.maximized {
        let _ = window.maximize();
    }
    if geometry.fullscreen {
        let _ = window.set_fullscreen(true);
    }
}

/// Writes the geometry of `window` to the state file next to the database.
fn persist(window: &Window) {
    let Ok(data_dir) = window.path().app_data_dir() else {
        return;
    };
    let Some(geometry) = geometry_of(window) else {
        return;
    };
    let path = window_state::state_path(&data_dir);
    let geometry = geometry.sanitized(screen_of(window));
    match window_state::save(&path, &geometry) {
        Ok(()) => {
            if smoke_mode() {
                println!(
                    "SOCDOF_WINDOW state_saved x={} y={} width={} height={} maximized={} fullscreen={} path={}",
                    geometry.x,
                    geometry.y,
                    geometry.width,
                    geometry.height,
                    geometry.maximized,
                    geometry.fullscreen,
                    path.display()
                );
            }
        }
        Err(error) => eprintln!("SOCDOF_WINDOW state_save_failed {error}"),
    }
}

/// Starts the SOCDOF desktop window.
///
/// The application data directory is created before the state is opened, so the database, the
/// instance lock and the window state always live in a writable location. Returns when the last
/// window closes.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(DesktopState::open(data_dir.join("socdof.db"))?);

            let path = window_state::state_path(&data_dir);
            let stored = window_state::load(&path);
            if let Some(window) = app.get_window("main") {
                let geometry = stored
                    .clone()
                    .unwrap_or_default()
                    .sanitized(screen_of(&window));
                apply(&window, &geometry);
                if stored.is_none() {
                    let _ = window_state::save(&path, &geometry);
                }
                if smoke_mode() {
                    println!(
                        "SOCDOF_WINDOW state_restored x={} y={} width={} height={} maximized={} fullscreen={} source={}",
                        geometry.x,
                        geometry.y,
                        geometry.width,
                        geometry.height,
                        geometry.maximized,
                        geometry.fullscreen,
                        if stored.is_some() { "file" } else { "default" }
                    );
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                persist(window);
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::database_status,
            commands::create_backup,
            commands::list_contacts,
            commands::create_contact,
            commands::update_contact,
            commands::delete_contact,
            commands::list_products,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::import_legacy_backup,
            commands::export_legacy_backup,
            commands::smoke_enabled,
            commands::finish_smoke,
            commands::abort_smoke
        ])
        .run(tauri::generate_context!())
        .expect("SOCDOF window failed to start");
}
