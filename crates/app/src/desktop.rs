//! Shared state for the desktop window layer.
//!
//! The Tauri commands are one-line adapters over [`DesktopState`]. Keeping the state in this crate,
//! instead of inside `src-tauri`, makes the exact command path testable on machines that have no
//! GTK/WebKit development packages.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::now_millis;

use crate::shell::{Paths, Shell, ShellStatus};

/// A backup written by the desktop command layer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BackupReport {
    /// Path of the archive that was written.
    pub path: PathBuf,
    /// Size of the archive file in bytes.
    pub bytes: u64,
    /// Size of the database inside the archive in bytes.
    pub database_bytes: u64,
    /// Schema version stored in the archive metadata.
    pub schema_version: i64,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

/// The desktop session managed by the window layer.
///
/// One state is created during application setup and then managed by Tauri. All commands share the
/// same [`Shell`], so the instance lock and the SQLite connection stay owned by one place.
pub struct DesktopState {
    shell: Mutex<Shell>,
}

impl DesktopState {
    /// Takes the instance lock and opens (or creates) the database.
    pub fn open(database: impl Into<PathBuf>) -> CoreResult<Self> {
        Ok(Self {
            shell: Mutex::new(Shell::start(Paths::new(database))?),
        })
    }

    /// Current database status for the first screen.
    pub fn status(&self) -> CoreResult<ShellStatus> {
        self.shell()?.status()
    }

    /// Writes a backup and returns its path and sizes.
    ///
    /// Without an explicit path the archive is written next to the database under
    /// `backups/socdof-<timestamp>.socdofbak`.
    pub fn backup(&self, archive: Option<&Path>) -> CoreResult<BackupReport> {
        let shell = self.shell()?;
        let archive = match archive {
            Some(path) => path.to_path_buf(),
            None => default_archive(&shell.paths().database),
        };

        if let Some(parent) = archive.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let info = shell.backup(&archive)?;
        Ok(BackupReport {
            path: archive,
            bytes: info.archive_bytes,
            database_bytes: info.database_bytes,
            schema_version: info.metadata.schema_version,
            created_at: info.metadata.created_at,
        })
    }

    fn shell(&self) -> CoreResult<MutexGuard<'_, Shell>> {
        self.shell
            .lock()
            .map_err(|_| CoreError::Validation("desktop_state_poisoned".to_string()))
    }
}

fn default_archive(database: &Path) -> PathBuf {
    let directory = database
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups");
    directory.join(format!("socdof-{}.socdofbak", now_millis()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_send_sync<T: Send + Sync>() {}

    #[test]
    fn desktop_state_can_be_managed_by_tauri() {
        assert_send_sync::<DesktopState>();
    }
}
