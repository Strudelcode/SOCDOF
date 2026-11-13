//! Native SOCDOF desktop host backed by the persistent SQLite store.
//!
//! Run with cargo run -p socdof-ui --features window --bin socdof-ui-desktop.
//! The component gallery remains a separate development tool; this binary starts the real
//! authentication and desktop flow without seeding sample business data.

use std::error::Error;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use eframe::egui;
use socdof_core::domain::settings::ThemeMode;
use socdof_core::lock::{InstanceLock, LOCK_FILE_NAME};
use socdof_core::now_millis;
use socdof_core::store::Store;
use socdof_ui::gallery::{gallery, GalleryState};
use socdof_ui::invoice_templates::native_asset_picker;
use socdof_ui::theme::Appearance;

struct DesktopApp {
    state: GalleryState,
    lock: InstanceLock,
    last_heartbeat: Instant,
}

impl DesktopApp {
    fn new() -> Result<Self, Box<dyn Error>> {
        let database = database_path()?;
        let parent = database
            .parent()
            .filter(|path| !path.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        std::fs::create_dir_all(parent)?;

        // Acquire the same lock filename as the TypeScript application before opening SQLite.
        let mut lock = InstanceLock::acquire(parent.join(LOCK_FILE_NAME))?;
        let store = Store::open(&database)?;
        let profile = store.company_profile()?;

        let appearance = match profile.theme_mode {
            ThemeMode::Dark => Appearance::Dark,
            ThemeMode::Light | ThemeMode::System => Appearance::Light,
        };
        let accent = if profile.accent_color.trim().is_empty() {
            "indigo"
        } else {
            profile.accent_color.trim()
        };
        let mut state = GalleryState::from_store(profile.language, appearance, accent, store)?;
        state.invoices.templates.set_asset_picker(native_asset_picker());
        lock.heartbeat(now_millis())?;

        Ok(Self {
            state,
            lock,
            last_heartbeat: Instant::now(),
        })
    }
}

impl eframe::App for DesktopApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
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
    let mut args = std::env::args_os().skip(1);
    while let Some(argument) = args.next() {
        if argument == "--database" {
            let value = args.next().ok_or("--database requires a path")?;
            return Ok(PathBuf::from(value));
        }
        if argument == "--help" || argument == "-h" {
            println!("SOCDOF native desktop\n\nUsage: socdof-ui-desktop [--database <path>]");
            std::process::exit(0);
        }
        return Err(format!("unknown argument: {}", argument.to_string_lossy()).into());
    }

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

    Ok(root.join("com.strudelcode.socdof").join("socdof.db"))
}

fn main() -> Result<(), Box<dyn Error>> {
    let app = DesktopApp::new()?;
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1440.0, 900.0])
            .with_min_inner_size([760.0, 560.0]),
        ..Default::default()
    };
    eframe::run_native(
        "SOCDOF",
        options,
        Box::new(move |_creation| Box::new(app)),
    )?;
    Ok(())
}
