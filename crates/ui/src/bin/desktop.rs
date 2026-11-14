//! Native SOCDOF desktop host backed by the persistent SQLite store.
//!
//! Run with cargo run -p socdof-ui --features window --bin socdof-ui-desktop.
//! The component gallery remains a separate development tool; this binary starts the real
//! authentication and desktop flow without seeding sample business data.

use std::error::Error;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
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

struct DesktopApp {
    state: GalleryState,
    lock: InstanceLock,
    last_heartbeat: Instant,
    follow_system_theme: bool,
    system_appearance: Option<Appearance>,
}

impl DesktopApp {
    fn new() -> Result<Self, Box<dyn Error>> {
        let database = database_path()?;
        let parent = database
            .parent()
            .filter(|path| !path.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        std::fs::create_dir_all(parent)?;

        // Preserve databases created by earlier native builds. Hold the legacy instance lock
        // while copying so an older running process cannot modify the database or its WAL.
        let legacy_lock = if !database.exists() {
            legacy_database_path()
                .filter(|legacy| legacy.exists())
                .map(|legacy| {
                    let legacy_parent = legacy
                        .parent()
                        .filter(|path| !path.as_os_str().is_empty())
                        .unwrap_or_else(|| Path::new("."));
                    InstanceLock::acquire(legacy_parent.join(LOCK_FILE_NAME))
                        .map(|lock| (legacy, lock))
                })
                .transpose()?
        } else {
            None
        };
        if let Some((legacy, _)) = legacy_lock.as_ref() {
            migrate_legacy_database(legacy, &database)?;
        }

        let mut lock = InstanceLock::acquire(parent.join(LOCK_FILE_NAME))?;
        // The new lock is active now; releasing the old lock closes the migration race.
        drop(legacy_lock);

        let store = Store::open(&database)?;
        let profile = store.company_profile()?;

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
        let mut state = GalleryState::from_store(profile.language, appearance, accent, store)?;
        state
            .invoices
            .templates
            .set_asset_picker(native_asset_picker());
        lock.heartbeat(now_millis())?;

        Ok(Self {
            state,
            lock,
            last_heartbeat: Instant::now(),
            follow_system_theme,
            system_appearance: None,
        })
    }
}

impl eframe::App for DesktopApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Keep idle-lock checks and the shared-instance heartbeat running even when the user
        // leaves the desktop untouched and egui would otherwise stop repainting.
        ctx.request_repaint_after(Duration::from_secs(1));
        // Capture the platform appearance before the SOCDOF theme is applied. Resolve the
        // active user's preference on every frame so changing Theme to System/Light/Dark takes
        // effect immediately, rather than inheriting the company profile forever.
        let system_appearance = *self.system_appearance.get_or_insert_with(|| {
            if ctx.style().visuals.dark_mode {
                Appearance::Dark
            } else {
                Appearance::Light
            }
        });
        let user_follows_system = self
            .state
            .auth
            .user
            .as_ref()
            .and_then(|user| settings_service::preferences(&self.state.store, user.id).ok())
            .map(|preferences| preferences.theme_mode == ThemeMode::System)
            .unwrap_or(self.follow_system_theme);
        if user_follows_system {
            self.state.appearance = system_appearance;
        }
        if self.last_heartbeat.elapsed() >= Duration::from_secs(5) {
            if let Err(error) = self.lock.heartbeat(now_millis()) {
                eprintln!("SOCDOF lock heartbeat failed: {error}");
            }
            self.last_heartbeat = Instant::now();
        }
        gallery(ctx, &mut self.state);
    }
}

fn database_path() -> Result<PathBuf, Box<dyn Error>> {
    database_path_from_args(std::env::args_os().skip(1), default_data_root()?)
}

fn database_path_from_args<I>(
    args: I,
    default_root: PathBuf,
) -> Result<PathBuf, Box<dyn Error>>
where
    I: IntoIterator<Item = OsString>,
{
    let mut args = args.into_iter();
    let mut data_dir = None;
    while let Some(argument) = args.next() {
        if argument == "--database" {
            let value = args.next().ok_or("--database requires a path")?;
            return Ok(PathBuf::from(value));
        }
        if argument == "--data-dir" {
            let value = args.next().ok_or("--data-dir requires a path")?;
            data_dir = Some(PathBuf::from(value));
            continue;
        }
        if argument == "--help" || argument == "-h" {
            println!(
                "SOCDOF native desktop\n\nUsage: socdof-ui-desktop [--database <path>] [--data-dir <folder>]"
            );
            std::process::exit(0);
        }
        return Err(format!("unknown argument: {}", argument.to_string_lossy()).into());
    }

    if let Some(data_dir) = data_dir {
        return Ok(data_dir.join("SOCDOF.db"));
    }
    if let Some(data_dir) = std::env::var_os("SOCDOF_DATA_DIR") {
        return Ok(PathBuf::from(data_dir).join("SOCDOF.db"));
    }
    Ok(default_root.join("SOCDOF").join("SOCDOF.db"))
}

fn default_data_root() -> Result<PathBuf, Box<dyn Error>> {
    #[cfg(target_os = "windows")]
    let root = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?);

    #[cfg(target_os = "macos")]
    let root = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir()?)
        .join("Library")
        .join("Application Support");

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let root = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .map(PathBuf::from)
                .map(|home| home.join(".local").join("share"))
        })
        .unwrap_or(std::env::current_dir()?);

    Ok(root)
}

fn legacy_database_path() -> Option<PathBuf> {
    let root = default_data_root().ok()?;
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
            let destination_sidecar =
                PathBuf::from(format!("{}{}", destination.display(), suffix));
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
    let app = DesktopApp::new()?;
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_min_inner_size([760.0, 560.0]),
        ..Default::default()
    };
    eframe::run_native("SOCDOF", options, Box::new(move |_creation| Box::new(app)))?;
    Ok(())
}
