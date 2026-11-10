//! Tauri window layer for SOCDOF.
//!
//! This crate only wires the webview to [`socdof_app::desktop::DesktopState`]. The startup sequence,
//! instance lock, SQLite access and backup format stay in `socdof-app` and `socdof-core`.
//!
//! Two pieces of behaviour live in `socdof-app` and are only performed here:
//! [`socdof_app::startup`] decides when the splash closes and which window becomes visible (including
//! the failure and timeout path), and [`socdof_app::window_state`] decides geometry restore and
//! clamping.

#![deny(missing_docs)]

pub mod commands;

use socdof_app::desktop::DesktopState;
use socdof_app::startup::{SplashAction, StartupHandshake};
use socdof_app::tray::{self, TrayCommand};
use socdof_app::window_state::{self, ScreenBounds, WindowGeometry};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, Window,
    WindowEvent,
};

/// Environment variable that marks a CI smoke run.
const SMOKE_ENV: &str = "SOCDOF_SMOKE_REPORT";

/// Environment variable that forces the startup failure path in CI.
const FAIL_STARTUP_ENV: &str = "SOCDOF_SMOKE_FAIL_STARTUP";

/// Whether the process runs the CI smoke contract (`SOCDOF_SMOKE_REPORT` set).
fn smoke_mode() -> bool {
    std::env::var_os(SMOKE_ENV).is_some()
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
fn apply_geometry(window: &Window, geometry: &WindowGeometry) {
    let _ = window.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = window.set_position(PhysicalPosition::new(geometry.x, geometry.y));
    if geometry.maximized {
        let _ = window.maximize();
    }
    if geometry.fullscreen {
        let _ = window.set_fullscreen(true);
    }
}

/// Creates the splash window with the static page from `ui/public/splash.html`.
fn show_splash(app: &AppHandle) {
    let created = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
        .title("SOCDOF")
        .inner_size(400.0, 240.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .center()
        .build();
    match created {
        Ok(_) => {
            if smoke_mode() {
                println!("SOCDOF_SPLASH splash_window=visible");
            }
        }
        Err(error) => {
            eprintln!("SOCDOF_SPLASH window_failed {error}");
        }
    }
}

/// Closes the splash window and reports it once.
fn close_splash(app: &AppHandle) {
    if let Some(splash) = app.get_window("splash") {
        if smoke_mode() {
            println!("SOCDOF_SPLASH splash_window=closed");
        }
        let _ = splash.close();
    }
}

/// Shows and focuses the main window, optionally in its error state.
fn show_main(app: &AppHandle, error: Option<&str>) {
    if let Some(main) = app.get_window("main") {
        if let Some(reason) = error {
            let _ = main.set_title(&format!("SOCDOF — start failed: {reason}"));
        }
        let _ = main.show();
        let _ = main.set_focus();
        if smoke_mode() {
            println!(
                "SOCDOF_SPLASH main_window=visible error={}",
                error.unwrap_or("-")
            );
        }
    }
}

/// Performs the window calls that belong to a handshake transition.
fn apply_action(app: &AppHandle, action: SplashAction, handshake: &StartupHandshake) {
    match action {
        SplashAction::None => {}
        SplashAction::ShowSplash => show_splash(app),
        SplashAction::ShowMain => {
            close_splash(app);
            show_main(app, None);
        }
        SplashAction::ShowError => {
            close_splash(app);
            show_main(app, handshake.reason());
        }
    }
    if smoke_mode() {
        println!("{}", handshake.marker());
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

/// Menu id of the tray icon.
const TRAY_ID: &str = "socdof-tray";

/// Locale of the desktop session, used for the tray labels.
fn system_locale() -> String {
    ["LC_ALL", "LC_MESSAGES", "LANG"]
        .iter()
        .find_map(|name| std::env::var(name).ok().filter(|value| !value.is_empty()))
        .unwrap_or_default()
}

/// Performs a tray command. The menu event and the left click on the icon both end here.
pub(crate) fn run_tray_command(app: &AppHandle, entry_id: &str, command: TrayCommand) {
    if smoke_mode() {
        println!("{}", tray::marker(entry_id, command));
    }
    match command {
        TrayCommand::ShowWindow => show_main(app, None),
        TrayCommand::CreateBackup => match app.state::<DesktopState>().backup(None) {
            Ok(report) => {
                if smoke_mode() {
                    println!(
                        "SOCDOF_TRAY backup path={} bytes={}",
                        report.path.display(),
                        report.bytes
                    );
                }
            }
            Err(error) => eprintln!("SOCDOF_TRAY backup_failed {error}"),
        },
        TrayCommand::Quit => app.exit(0),
    }
}

/// Builds the platform tray icon from `socdof_app::tray`.
fn create_tray(app: &AppHandle, locale: &str) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    for entry in tray::menu() {
        match entry.command {
            Some(_) => {
                let item = MenuItem::with_id(
                    app,
                    entry.id,
                    tray::label_for_locale(locale, entry.label_key),
                    true,
                    None::<&str>,
                )?;
                menu.append(&item)?;
            }
            None => menu.append(&PredefinedMenuItem::separator(app)?)?,
        }
    }

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tray::tooltip_for_locale(locale))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref().to_string();
            if let Some(command) = tray::command_for(&id) {
                run_tray_command(app, &id, command);
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

/// Starts the SOCDOF desktop window.
///
/// The application data directory is created before the state is opened, so the database, the
/// instance lock and the window state always live in a writable location. The main window starts
/// hidden (`"visible": false` in `tauri.conf.json`) and is shown by the handshake, so the user sees
/// either the splash or the finished window — never an empty frame. Returns when the last window
/// closes.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let handle = app.handle().clone();
            let mut handshake = StartupHandshake::new();

            show_splash(&handle);
            if smoke_mode() {
                println!("{}", handshake.marker());
            }

            let open = if std::env::var_os(FAIL_STARTUP_ENV).is_some() {
                Err("database_error".to_string())
            } else {
                DesktopState::open(data_dir.join("socdof.db")).map_err(|error| error.to_string())
            };

            match open {
                Ok(state) => {
                    app.manage(state);
                    let action = handshake.mark_ready();
                    apply_action(&handle, action, &handshake);
                }
                Err(error) => {
                    eprintln!("SOCDOF startup failed: {error}");
                    let action = handshake.mark_failed("database_error");
                    apply_action(&handle, action, &handshake);
                }
            }

            let path = window_state::state_path(&data_dir);
            let stored = window_state::load(&path);
            if let Some(window) = app.get_window("main") {
                let geometry = stored
                    .clone()
                    .unwrap_or_default()
                    .sanitized(screen_of(&window));
                apply_geometry(&window, &geometry);
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
            if smoke_mode() && std::env::var_os("SOCDOF_SMOKE_DIALOGS").is_some() {
                commands::dialog_smoke();
            }

            let locale = system_locale();
            match create_tray(&handle, &locale) {
                Ok(()) => {
                    if smoke_mode() {
                        println!("SOCDOF_TRAY tray_icon=created");
                    }
                }
                Err(error) => eprintln!("SOCDOF_TRAY tray_icon=failed {error}"),
            }
            if smoke_mode() && std::env::var_os("SOCDOF_SMOKE_TRAY").is_some() {
                commands::tray_smoke(&handle);
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
            commands::smoke_idle,
            commands::dispatch_shortcut,
            commands::pick_folder,
            commands::pick_open_file,
            commands::pick_save_file,
            commands::show_message,
            commands::finish_smoke,
            commands::abort_smoke
        ])
        .run(tauri::generate_context!())
        .expect("SOCDOF window failed to start");
}
