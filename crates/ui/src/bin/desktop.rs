//! Native SOCDOF desktop host backed by the persistent SQLite store.
//!
//! Run with cargo run -p socdof-ui --features window --bin socdof-ui-desktop.
//! The component gallery remains a separate development tool; this binary starts the real
//! authentication and desktop flow without seeding sample business data.

use std::error::Error;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::thread;
use std::time::{Duration, Instant};

use eframe::egui;
use socdof_core::domain::settings::ThemeMode;
use socdof_core::lock::{InstanceLock, LOCK_FILE_NAME};
use socdof_core::now_millis;
use socdof_core::settings_service;
use socdof_core::store::Store;
use socdof_ui::gallery::{gallery, GalleryState};
use socdof_ui::invoice_templates::native_asset_picker;
use socdof_ui::theme::Appearance;

struct LoadedStore {
    store: Store,
    lock: InstanceLock,
}

struct DesktopRuntime {
    state: GalleryState,
    lock: InstanceLock,
    last_heartbeat: Instant,
    follow_system_theme: bool,
    system_appearance: Option<Appearance>,
}

struct DesktopApp {
    startup: Receiver<Result<LoadedStore, String>>,
    startup_error: Option<String>,
    runtime: Option<DesktopRuntime>,
    splash_shown: bool,
    system_appearance: Option<Appearance>,
}

impl DesktopApp {
    /// Creates the native window host without waiting for SQLite migrations or data recovery.
    ///
    /// The first frame is a real splash screen. Database creation, legacy migration, lock
    /// acquisition and schema upgrades happen on a worker thread so a slow disk never leaves
    /// the user staring at an unpainted window.
    fn new() -> Self {
        Self {
            startup: start_store_loading(),
            startup_error: None,
            runtime: None,
            splash_shown: false,
            system_appearance: None,
        }
    }

    fn start_loading(&mut self) {
        self.startup = start_store_loading();
        self.startup_error = None;
    }

    fn finish_startup(&mut self, loaded: LoadedStore) -> Result<(), Box<dyn Error>> {
        let profile = loaded.store.company_profile()?;
        let appearance = match profile.theme_mode {
            ThemeMode::Dark => Appearance::Dark,
            ThemeMode::Light | ThemeMode::System => Appearance::Light,
        };
        let follow_system_theme = profile.theme_mode == ThemeMode::System;
        let accent = if profile.accent_color.trim().is_empty() {
            "indigo"
        } else {
            profile.accent_color.trim()
        };
        let mut state =
            GalleryState::from_store(profile.language, appearance, accent, loaded.store)?;
        state
            .invoices
            .templates
            .set_asset_picker(native_asset_picker());

        self.runtime = Some(DesktopRuntime {
            state,
            lock: loaded.lock,
            last_heartbeat: Instant::now(),
            follow_system_theme,
            system_appearance: self.system_appearance,
        });
        self.startup_error = None;
        Ok(())
    }
}

fn start_store_loading() -> Receiver<Result<LoadedStore, String>> {
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let result = load_store().map_err(|error| error.to_string());
        let _ = sender.send(result);
    });
    receiver
}

fn load_store() -> Result<LoadedStore, Box<dyn Error>> {
    let database = database_path()?;
    let parent = database
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent)?;

    // Preserve databases created by earlier native builds. Hold the legacy instance lock
    // while copying so an older running process cannot modify the database or its WAL.
    let legacy_lock = if !database.exists() {
        legacy_database_path(&database)
            .filter(|legacy| legacy.exists())
            .map(|legacy| {
                let legacy_parent = legacy
                    .parent()
                    .filter(|path| !path.as_os_str().is_empty())
                    .unwrap_or_else(|| Path::new("."));
                InstanceLock::acquire(legacy_parent.join(LOCK_FILE_NAME)).map(|lock| (legacy, lock))
            })
            .transpose()?
    } else {
        None
    };
    if let Some((legacy, _)) = legacy_lock.as_ref() {
        migrate_legacy_database(legacy, &database)?;
    }

    let lock = InstanceLock::acquire(parent.join(LOCK_FILE_NAME))?;
    // The new lock is active now; releasing the old lock closes the migration race.
    drop(legacy_lock);

    let store = Store::open(&database)?;
    let mut lock = lock;
    lock.heartbeat(now_millis())?;
    Ok(LoadedStore { store, lock })
}

impl eframe::App for DesktopApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.system_appearance.get_or_insert_with(|| {
            socdof_ui::theme::detect_system_appearance().unwrap_or_else(|| {
                if ctx.style().visuals.dark_mode {
                    Appearance::Dark
                } else {
                    Appearance::Light
                }
            })
        });
        if self.runtime.is_none() {
            // Always paint one splash frame before accepting even an already-completed worker.
            if !self.splash_shown {
                self.splash_shown = true;
                paint_startup(ctx, None);
                ctx.request_repaint_after(Duration::from_millis(100));
                return;
            }

            match self.startup.try_recv() {
                Ok(Ok(loaded)) => {
                    if let Err(error) = self.finish_startup(loaded) {
                        self.startup_error = Some(error.to_string());
                    }
                }
                Ok(Err(error)) => self.startup_error = Some(error),
                Err(TryRecvError::Disconnected) => {
                    self.startup_error
                        .get_or_insert_with(|| "The startup worker stopped unexpectedly.".into());
                }
                Err(TryRecvError::Empty) => {}
            }

            if self.runtime.is_none() {
                if paint_startup(ctx, self.startup_error.as_deref()) {
                    self.start_loading();
                }
                ctx.request_repaint_after(Duration::from_millis(120));
                return;
            }
        }

        let runtime = self.runtime.as_mut().expect("runtime initialized above");
        // Login/setup screens are static while idle; repaint them less often. A temporary
        // lockout countdown still needs one-second updates. The active desktop has its own
        // ten-second repaint schedule in desktop_with_content.
        let repaint_after = if runtime.state.auth_open {
            if runtime.state.auth.locked_until.is_some() {
                Duration::from_secs(1)
            } else {
                Duration::from_secs(15)
            }
        } else {
            Duration::from_secs(10)
        };
        ctx.request_repaint_after(repaint_after);
        // Capture the platform appearance before the SOCDOF theme is applied. Resolve the
        // active user's preference on every frame so changing Theme to System/Light/Dark takes
        // effect immediately, rather than inheriting the company profile forever.
        let system_appearance = *runtime.system_appearance.get_or_insert_with(|| {
            socdof_ui::theme::detect_system_appearance().unwrap_or_else(|| {
                if ctx.style().visuals.dark_mode {
                    Appearance::Dark
                } else {
                    Appearance::Light
                }
            })
        });
        let user_follows_system = runtime
            .state
            .auth
            .user
            .as_ref()
            .and_then(|user| settings_service::preferences(&runtime.state.store, user.id).ok())
            .map(|preferences| preferences.theme_mode == ThemeMode::System)
            .unwrap_or(runtime.follow_system_theme);
        if user_follows_system {
            runtime.state.appearance = system_appearance;
        }
        if runtime.last_heartbeat.elapsed() >= Duration::from_secs(5) {
            if let Err(error) = runtime.lock.heartbeat(now_millis()) {
                eprintln!("SOCDOF lock heartbeat failed: {error}");
            }
            runtime.last_heartbeat = Instant::now();
        }
        ctx.set_zoom_factor(runtime.state.settings.ui_scale_factor());
        gallery(ctx, &mut runtime.state);
        if let Some(tint) = runtime.state.settings.night_light_overlay() {
            let layer = egui::LayerId::new(
                egui::Order::Foreground,
                egui::Id::new("socdof-native-night-light"),
            );
            ctx.layer_painter(layer)
                .rect_filled(ctx.screen_rect(), 0.0, tint);
        }
    }
}

fn paint_startup(ctx: &egui::Context, error: Option<&str>) -> bool {
    let mut retry = false;
    ctx.set_visuals(egui::Visuals::dark());
    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(egui::Color32::from_rgb(9, 8, 28)))
        .show(ctx, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(ui.available_height() * 0.28);
                ui.label(
                    egui::RichText::new("SOCDOF")
                        .size(36.0)
                        .strong()
                        .color(egui::Color32::from_rgb(220, 190, 255)),
                );
                ui.add_space(12.0);
                if let Some(error) = error {
                    ui.label(
                        egui::RichText::new("SOCDOF konnte nicht gestartet werden")
                            .size(16.0)
                            .strong(),
                    );
                    ui.add_space(8.0);
                    ui.label(error);
                    ui.add_space(16.0);
                    retry = ui.button("Erneut versuchen").clicked();
                } else {
                    ui.add_space(8.0);
                    ui.spinner();
                    ui.label("Arbeitsumgebung wird vorbereitet …");
                }
            });
        });
    retry
}

fn database_path() -> Result<PathBuf, Box<dyn Error>> {
    let paths = socdof_core::data_paths::DataPaths::resolve(
        std::env::args_os().skip(1),
        default_data_root()?,
        std::env::var_os(socdof_core::data_paths::DATA_DIRECTORY_ENV).map(PathBuf::from),
    )?;
    Ok(paths.database)
}

fn database_path_from_args<I>(args: I, default_root: PathBuf) -> Result<PathBuf, Box<dyn Error>>
where
    I: IntoIterator<Item = OsString>,
{
    let paths = socdof_core::data_paths::DataPaths::resolve(args, default_root, None)?;
    Ok(paths.database)
}

fn default_data_root() -> Result<PathBuf, Box<dyn Error>> {
    Ok(socdof_core::data_paths::default_data_root()?)
}

fn legacy_database_path(database: &Path) -> Option<PathBuf> {
    let root = default_data_root().ok()?;
    let current_default = root.join("SOCDOF").join("SOCDOF.db");
    if database != current_default {
        return None;
    }
    Some(root.join("com.strudelcode.socdof").join("socdof.db"))
}

/// Copies a legacy SQLite database and its WAL sidecars without deleting the original.
fn migrate_legacy_database(source: &Path, destination: &Path) -> Result<(), Box<dyn Error>> {
    let parent = destination
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent)?;
    std::fs::copy(source, destination)?;
    for suffix in ["-wal", "-shm"] {
        let source_sidecar = PathBuf::from(format!("{}{}", source.display(), suffix));
        if source_sidecar.exists() {
            let destination_sidecar = PathBuf::from(format!("{}{}", destination.display(), suffix));
            std::fs::copy(source_sidecar, destination_sidecar)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_database_uses_a_clear_socdof_data_folder() {
        let path = database_path_from_args(Vec::<OsString>::new(), PathBuf::from("appdata"))
            .expect("default database path");
        assert_eq!(path, PathBuf::from("appdata/SOCDOF/SOCDOF.db"));
    }

    #[test]
    fn data_directory_override_keeps_the_database_filename_stable() {
        let path = database_path_from_args(
            ["--data-dir", "D:/SOCDOF-Data"]
                .into_iter()
                .map(OsString::from),
            PathBuf::from("unused"),
        )
        .expect("custom database path");
        assert_eq!(path, PathBuf::from("D:/SOCDOF-Data/SOCDOF.db"));
    }

    #[test]
    fn explicit_database_path_takes_precedence_over_data_directory() {
        let path = database_path_from_args(
            ["--data-dir", "D:/Data", "--database", "E:/custom.db"]
                .into_iter()
                .map(OsString::from),
            PathBuf::from("unused"),
        )
        .expect("explicit database path");
        assert_eq!(path, PathBuf::from("E:/custom.db"));
    }

    #[test]
    fn legacy_migration_preserves_the_source_and_copies_wal_files() {
        let root = std::env::temp_dir().join(format!("socdof-migration-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("temp folder");
        let source = root.join("legacy.db");
        let destination = root.join("SOCDOF").join("SOCDOF.db");
        std::fs::write(&source, b"database").expect("legacy database");
        std::fs::write(format!("{}-wal", source.display()), b"wal").expect("legacy wal");

        migrate_legacy_database(&source, &destination).expect("migration");

        assert_eq!(std::fs::read(&source).expect("source remains"), b"database");
        assert_eq!(
            std::fs::read(&destination).expect("destination"),
            b"database"
        );
        assert_eq!(
            std::fs::read(format!("{}-wal", destination.display())).expect("copied wal"),
            b"wal"
        );
        std::fs::remove_dir_all(root).expect("cleanup");
    }
}

#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() -> Result<(), Box<dyn Error>> {
    let arguments = std::env::args_os().skip(1).collect::<Vec<_>>();
    if arguments
        .iter()
        .any(|argument| argument == "--help" || argument == "-h")
    {
        println!(
            "SOCDOF native desktop\n\nUsage: socdof-ui-desktop [--database <path>] [--data-dir <folder>] [--version]"
        );
        return Ok(());
    }
    if arguments
        .iter()
        .any(|argument| argument == "--version" || argument == "-V")
    {
        println!("SOCDOF {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_min_inner_size([760.0, 560.0]),
        ..Default::default()
    };
    eframe::run_native(
        "SOCDOF",
        options,
        Box::new(move |creation| {
            // Install the bundled font families before the first egui frame. Applying the
            // theme only from Gallery::update is too late on some native backends: the
            // first frame can resolve RichText against the custom Semibold family before
            // epaint has rebuilt its font atlas.
            socdof_ui::theme::install_fonts(&creation.egui_ctx);
            Box::new(DesktopApp::new())
        }),
    )?;
    Ok(())
}
