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
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
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
fn geometry_of(window: &WebviewWindow) -> Option<WindowGeometry> {
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
fn screen_of(window: &WebviewWindow) -> ScreenBounds {
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
fn apply_geometry(window: &WebviewWindow, geometry: &WindowGeometry) {
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
    if let Some(splash) = app.get_webview_window("splash") {
        if smoke_mode() {
            println!("SOCDOF_SPLASH splash_window=closed");
        }
        let _ = splash.close();
    }
}

/// Shows and focuses the main window, optionally in its error state.
fn show_main(app: &AppHandle, error: Option<&str>) {
    if let Some(main) = app.get_webview_window("main") {
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
fn persist(window: &WebviewWindow) {
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
        })
        .on_tray_icon_event(|tray, event| {
            // Windows and macOS emit icon clicks; Linux status notifiers only provide the menu.
            // Both paths use the same ShowWindow command as the menu entry.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let (entry_id, command) = tray::icon_click();
                run_tray_command(tray.app_handle(), entry_id, command);
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
            if let Some(window) = app.get_webview_window("main") {
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

            let locale = system_locale();
            match create_tray(&handle, &locale) {
                Ok(()) => {
                    if smoke_mode() {
                        println!("SOCDOF_TRAY tray_icon=created");
                    }
                }
                Err(error) => eprintln!("SOCDOF_TRAY tray_icon=failed {error}"),
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    persist(&webview);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::database_status,
            commands::dashboard,
            commands::users,
            commands::save_user,
            commands::delete_user,
            commands::login_user,
            commands::storage_inspector,
            commands::create_backup,
            commands::backup_files,
            commands::save_backup_to_disk,
            commands::open_backup_folder,
            commands::select_backup_folder,
            commands::company_profile,
            commands::save_company_profile,
            commands::journal_entries,
            commands::journal_summary,
            commands::journal_cash_book,
            commands::save_journal_entry,
            commands::delete_journal_entry,
            commands::export_journal_csv,
            commands::purchase_orders,
            commands::save_purchase_order,
            commands::delete_purchase_order,
            commands::set_purchase_order_status,
            commands::receive_purchase_order,
            commands::report,
            commands::app_store_modules,
            commands::app_store_set_active,
            commands::verify_backup,
            commands::restore_backup,
            commands::appointments,
            commands::save_appointment,
            commands::delete_appointment,
            commands::list_documents,
            commands::save_document,
            commands::delete_document,
            commands::textwerk_open_dialog,
            commands::textwerk_save_dialog,
            commands::window_is_fullscreen,
            commands::window_set_fullscreen,
            commands::window_toggle_fullscreen,
            commands::window_is_maximized,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::window_minimize,
            commands::invoice_templates,
            commands::save_invoice_templates,
            commands::template_token_keys,
            commands::template_default_stationery_tokens,
            commands::list_invoices,
            commands::invoice_detail,
            commands::invoice_defaults,
            commands::save_invoice,
            commands::delete_invoice,
            commands::set_invoice_status,
            commands::invoice_preview,
            commands::export_invoice,
            commands::list_contacts,
            commands::create_contact,
            commands::update_contact,
            commands::delete_contact,
            commands::export_contacts_csv,
            commands::import_contacts_csv,
            commands::export_contacts_vcf,
            commands::search_countries,
            commands::product_label,
            commands::reorder_plan,
            commands::create_reorder_draft,
            commands::set_product_reorder_exclusion,
            commands::list_products,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::import_legacy_backup,
            commands::export_legacy_backup,
            commands::smoke_enabled,
            commands::smoke_idle,
            commands::smoke_options,
            commands::smoke_tray_run,
            commands::dispatch_shortcut,
            commands::pick_folder,
            commands::pick_open_file,
            commands::pick_save_file,
            commands::show_message,
            commands::confirm_message,
            commands::list_external_templates,
            commands::read_external_template,
            commands::list_external_languages,
            commands::list_available_flags,
            commands::save_external_language,
            commands::external_folder_path,
            commands::open_external_folder,
            commands::finish_smoke,
            commands::smoke_ui_marker,
            commands::abort_smoke,
            commands::invoice_dunning,
            commands::invoice_mail_draft,
            commands::invoice_payment,
            commands::record_invoice_payment,
            commands::export_invoice_eml,
            commands::contact_mail_draft,
            commands::export_contact_eml,
            commands::invoice_fattura,
            commands::export_invoice_fattura,
            commands::fleet_overview,
            commands::save_fleet_vehicle,
            commands::delete_fleet_vehicle,
            commands::save_fleet_trip,
            commands::delete_fleet_trip,
            commands::save_fleet_fuel,
            commands::delete_fleet_fuel,
            commands::export_fleet_csv,
            commands::project_overview,
            commands::save_project,
            commands::delete_project,
            commands::save_project_task,
            commands::set_project_task_status,
            commands::delete_project_task,
            commands::export_projects_csv,
            commands::project_persistence,
            commands::create_project_invoice,
            commands::restaurant_overview,
            commands::save_restaurant_menu_item,
            commands::delete_restaurant_menu_item,
            commands::add_restaurant_item,
            commands::set_restaurant_order_item_qty,
            commands::set_restaurant_order_item_notes,
            commands::set_restaurant_order_server,
            commands::set_restaurant_order_status,
            commands::delete_restaurant_order,
            commands::restaurant_checkout,
            commands::export_restaurant_csv,
            commands::restaurant_persistence
        ])
        .build(tauri::generate_context!())
        .expect("SOCDOF window failed to start")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(state) = app.try_state::<DesktopState>() {
                    state.release_lock();
                }
            }
        });
}
