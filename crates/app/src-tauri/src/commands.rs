//! Tauri commands exposed to the SOCDOF frontend.
//!
//! Every command delegates to [`socdof_app::desktop::DesktopState`]; no SQL, file format or business
//! rule is implemented here.
//!
//! The `*_smoke` commands are only active when `SOCDOF_SMOKE_REPORT` is set. They let CI start the
//! real WebView, invoke the normal commands from the loaded frontend, persist the returned values and
//! terminate with a status that reflects whether the runtime contract held.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use socdof_app::desktop::{BackupReport, DesktopState};
use socdof_app::shell::ShellStatus;

const SMOKE_REPORT_ENV: &str = "SOCDOF_SMOKE_REPORT";

/// Returns whether the runtime smoke mode is enabled.
#[tauri::command]
pub fn smoke_enabled() -> bool {
    smoke_report_path().is_some()
}

/// Returns the schema version, row counts and lock owner of the open database.
#[tauri::command]
pub fn database_status(state: tauri::State<'_, DesktopState>) -> Result<ShellStatus, String> {
    let status = state.status().map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE database_status schema_version={} database={}",
            status.schema_version,
            status.database.display()
        ));
    }
    Ok(status)
}

/// Writes a backup next to the database and returns its path and sizes.
#[tauri::command]
pub fn create_backup(state: tauri::State<'_, DesktopState>) -> Result<BackupReport, String> {
    let report = state.backup(None).map_err(|error| error.to_string())?;
    if smoke_report_path().is_some() {
        smoke_log(&format!(
            "SOCDOF_SMOKE create_backup path={} bytes={} database_bytes={}",
            report.path.display(),
            report.bytes,
            report.database_bytes
        ));
    }
    Ok(report)
}

/// The values the loaded frontend received from `database_status` and `create_backup`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SmokeReport {
    /// Schema version returned by `database_status`.
    pub schema_version: i64,
    /// Database path returned by `database_status`.
    pub database: String,
    /// Backup path returned by `create_backup`.
    pub backup_path: String,
    /// Number of bytes written by `create_backup`.
    pub backup_bytes: u64,
}

/// Verifies the frontend report against the live desktop state and writes it for CI.
///
/// This command exists only for the Xvfb smoke run. It refuses to run without
/// `SOCDOF_SMOKE_REPORT`, validates every value against the live database, writes the JSON report
/// and exits the application with code 0. Any mismatch produces a report with an `error` field and
/// exits with code 1.
#[tauri::command]
pub fn finish_smoke(
    app: tauri::AppHandle,
    state: tauri::State<'_, DesktopState>,
    report: SmokeReport,
) -> Result<(), String> {
    let Some(path) = smoke_report_path() else {
        return Err("smoke mode is not enabled".to_string());
    };

    if let Err(error) = validate_smoke_report(&state, &report) {
        smoke_log(&format!("SOCDOF_SMOKE_FAILED error={error}"));
        let _ = std::fs::write(&path, serde_json::json!({ "error": &error }).to_string());
        app.exit(1);
        return Err(error);
    }

    let json = serde_json::to_vec_pretty(&report).map_err(|error| error.to_string())?;
    if let Err(error) = std::fs::write(&path, json) {
        smoke_log(&format!("SOCDOF_SMOKE_FAILED error={error}"));
        app.exit(1);
        return Err(error.to_string());
    }

    smoke_log(&format!(
        "SOCDOF_SMOKE_OK schema_version={} database={} backup_path={} backup_bytes={}",
        report.schema_version, report.database, report.backup_path, report.backup_bytes
    ));
    app.exit(0);
    Ok(())
}

/// Aborts the smoke run with an error report when the frontend could not invoke a command.
#[tauri::command]
pub fn abort_smoke(app: tauri::AppHandle, message: String) -> Result<(), String> {
    let Some(path) = smoke_report_path() else {
        return Err("smoke mode is not enabled".to_string());
    };

    smoke_log(&format!("SOCDOF_SMOKE_FAILED error={message}"));
    let _ = std::fs::write(&path, serde_json::json!({ "error": &message }).to_string());
    app.exit(1);
    Ok(())
}

fn smoke_report_path() -> Option<PathBuf> {
    std::env::var_os(SMOKE_REPORT_ENV).map(PathBuf::from)
}

fn smoke_log(message: &str) {
    println!("{message}");
    let _ = std::io::stdout().flush();
}

fn validate_smoke_report(state: &DesktopState, report: &SmokeReport) -> Result<(), String> {
    let status = state.status().map_err(|error| error.to_string())?;

    if status.schema_version != report.schema_version {
        return Err(format!(
            "schema version mismatch: live={} reported={}",
            status.schema_version, report.schema_version
        ));
    }
    if status.database.as_path() != Path::new(&report.database) {
        return Err(format!(
            "database path mismatch: live={} reported={}",
            status.database.display(),
            report.database
        ));
    }

    let backup = Path::new(&report.backup_path);
    let metadata =
        std::fs::metadata(backup).map_err(|error| format!("backup is missing: {error}"))?;
    if !metadata.is_file() {
        return Err(format!("backup is not a file: {}", backup.display()));
    }
    if metadata.len() == 0 || report.backup_bytes == 0 {
        return Err("backup is empty".to_string());
    }
    if metadata.len() != report.backup_bytes {
        return Err(format!(
            "backup size mismatch: file={} reported={}",
            metadata.len(),
            report.backup_bytes
        ));
    }

    let mut magic = [0u8; 8];
    std::fs::File::open(backup)
        .and_then(|mut file| file.read_exact(&mut magic))
        .map_err(|error| format!("backup cannot be read: {error}"))?;
    if &magic != b"SOCDOFBK" {
        return Err("backup does not start with the SOCDOF container magic".to_string());
    }

    Ok(())
}
