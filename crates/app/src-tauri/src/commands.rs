//! Tauri commands exposed to the SOCDOF frontend.
//!
//! Every command delegates to [`socdof_app::desktop::DesktopState`]; no SQL, file format or business
//! rule is implemented here.

use socdof_app::desktop::{BackupReport, DesktopState};
use socdof_app::shell::ShellStatus;

/// Returns the schema version, row counts and lock owner of the open database.
#[tauri::command]
pub fn database_status(state: tauri::State<'_, DesktopState>) -> Result<ShellStatus, String> {
    state.status().map_err(|error| error.to_string())
}

/// Writes a backup next to the database and returns its path and sizes.
#[tauri::command]
pub fn create_backup(state: tauri::State<'_, DesktopState>) -> Result<BackupReport, String> {
    state.backup(None).map_err(|error| error.to_string())
}
