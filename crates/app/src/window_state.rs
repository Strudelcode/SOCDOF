//! Persisted geometry of the desktop window.
//!
//! The state is stored as `window_state.json` next to the database. The window layer reads it before
//! the main window is shown and writes it when the window closes, so size, position and the
//! maximized/fullscreen flags survive a restart. Nothing here depends on GTK or WebKit: the window
//! layer only converts between its physical pixels and [`WindowGeometry`], which keeps the whole
//! decision path testable without a display.

use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// File name of the window state, next to `socdof.db` and `network_session.lock`.
pub const WINDOW_STATE_FILE_NAME: &str = "window_state.json";

/// Schema version written into the file; a file with another version is ignored.
pub const STATE_SCHEMA_VERSION: i64 = 1;

/// Width of the main window on the very first start, in physical pixels.
pub const DEFAULT_WIDTH: u32 = 1100;

/// Height of the main window on the very first start, in physical pixels.
pub const DEFAULT_HEIGHT: u32 = 720;

/// Smallest width the window may be restored with, matching `minWidth` in `tauri.conf.json`.
pub const MIN_WIDTH: u32 = 760;

/// Smallest height the window may be restored with, matching `minHeight` in `tauri.conf.json`.
pub const MIN_HEIGHT: u32 = 560;

/// Position and size of the main window in physical pixels.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowGeometry {
    /// Left edge of the window on the virtual desktop.
    #[serde(default)]
    pub x: i32,
    /// Top edge of the window on the virtual desktop.
    #[serde(default)]
    pub y: i32,
    /// Window width in physical pixels.
    #[serde(default = "default_width")]
    pub width: u32,
    /// Window height in physical pixels.
    #[serde(default = "default_height")]
    pub height: u32,
    /// Whether the window was maximized.
    #[serde(default)]
    pub maximized: bool,
    /// Whether the window was fullscreen.
    #[serde(default)]
    pub fullscreen: bool,
}

fn default_width() -> u32 {
    DEFAULT_WIDTH
}

fn default_height() -> u32 {
    DEFAULT_HEIGHT
}

impl Default for WindowGeometry {
    fn default() -> Self {
        Self {
            x: 0,
            y: 0,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            maximized: false,
            fullscreen: false,
        }
    }
}

/// Rectangle of the monitor the window sits on, in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenBounds {
    /// Left edge of the monitor.
    pub x: i32,
    /// Top edge of the monitor.
    pub y: i32,
    /// Monitor width in physical pixels.
    pub width: u32,
    /// Monitor height in physical pixels.
    pub height: u32,
}

impl Default for ScreenBounds {
    fn default() -> Self {
        Self {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }
}

impl WindowGeometry {
    /// Returns the geometry clamped to [`MIN_WIDTH`]/[`MIN_HEIGHT`] and onto `screen`.
    ///
    /// A window that was saved on a monitor that no longer exists would otherwise start invisible,
    /// so the position is pulled back into `screen` while keeping the window size.
    pub fn sanitized(mut self, screen: ScreenBounds) -> Self {
        self.width = self.width.max(MIN_WIDTH);
        self.height = self.height.max(MIN_HEIGHT);
        let max_x = screen.x + screen.width.saturating_sub(self.width) as i32;
        let max_y = screen.y + screen.height.saturating_sub(self.height) as i32;
        self.x = self.x.min(max_x).max(screen.x);
        self.y = self.y.min(max_y).max(screen.y);
        self
    }
}

/// The state document written to disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct WindowStateFile {
    #[serde(default)]
    schema_version: i64,
    #[serde(default)]
    main: Option<WindowGeometry>,
}

/// Returns the state path that belongs to a data directory.
pub fn state_path(data_dir: &Path) -> PathBuf {
    data_dir.join(WINDOW_STATE_FILE_NAME)
}

/// Reads the stored geometry.
///
/// A missing file, unreadable JSON or a document from another schema version all return `None`, so
/// the caller falls back to [`WindowGeometry::default`] instead of failing to start.
pub fn load(path: &Path) -> Option<WindowGeometry> {
    let text = std::fs::read_to_string(path).ok()?;
    let file: WindowStateFile = serde_json::from_str(&text).ok()?;
    if file.schema_version != STATE_SCHEMA_VERSION {
        return None;
    }
    file.main
}

/// Writes the geometry atomically: the document is written to `window_state.json.tmp` and renamed,
/// so a crash during the write never leaves half a file behind.
pub fn save(path: &Path, geometry: &WindowGeometry) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let document = WindowStateFile {
        schema_version: STATE_SCHEMA_VERSION,
        main: Some(geometry.clone()),
    };
    let text = serde_json::to_string_pretty(&document)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text)?;
    std::fs::rename(&temporary, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("socdof-window-state-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    #[test]
    fn roundtrip_survives_a_restart() {
        let dir = scratch_dir();
        let path = state_path(&dir);
        let saved = WindowGeometry {
            x: 120,
            y: 80,
            width: 1400,
            height: 900,
            maximized: true,
            fullscreen: false,
        };
        save(&path, &saved).expect("save");
        assert_eq!(load(&path), Some(saved));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn missing_or_broken_file_falls_back_to_the_default_window() {
        let dir = scratch_dir();
        let path = state_path(&dir);
        assert_eq!(load(&path), None);
        std::fs::write(&path, "{ not json").expect("write");
        assert_eq!(load(&path), None);
        std::fs::write(&path, r#"{"schema_version": 99, "main": {"width": 1}}"#).expect("write");
        assert_eq!(load(&path), None);
        assert_eq!(
            WindowGeometry::default().sanitized(ScreenBounds::default()),
            WindowGeometry::default()
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clamps_a_window_below_the_minimum_size() {
        let saved = WindowGeometry {
            x: 10,
            y: 10,
            width: 300,
            height: 200,
            maximized: false,
            fullscreen: false,
        };
        let restored = saved.sanitized(ScreenBounds::default());
        assert_eq!((restored.width, restored.height), (MIN_WIDTH, MIN_HEIGHT));
    }

    #[test]
    fn pulls_a_window_from_a_vanished_monitor_back_onto_the_screen() {
        let saved = WindowGeometry {
            x: 5000,
            y: -9000,
            width: 1200,
            height: 800,
            maximized: false,
            fullscreen: false,
        };
        let screen = ScreenBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };
        let restored = saved.sanitized(screen);
        assert_eq!(restored.x, 720);
        assert_eq!(restored.y, 0);
        assert_eq!((restored.width, restored.height), (1200, 800));
    }

    #[test]
    fn write_is_atomic_and_leaves_no_temporary_file() {
        let dir = scratch_dir();
        let path = state_path(&dir);
        save(&path, &WindowGeometry::default()).expect("save");
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .expect("read dir")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temporary files left: {leftovers:?}");
        std::fs::remove_dir_all(&dir).ok();
    }
}
