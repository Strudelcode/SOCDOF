//! Local log file and crash reports.
//!
//! SOCDOF writes plain JSON lines into `socdof.log` next to the database and rotates the file when
//! it grows too large. Nothing is sent anywhere: there is no telemetry, and a crash report is a
//! local file the user can attach to a support ticket themselves.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde_json::json;

use crate::error::CoreResult;

/// Maximum size of the log file before it is rotated.
pub const DEFAULT_MAX_BYTES: u64 = 1_000_000;

/// Severity of a log line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    /// Development detail.
    Debug,
    /// Normal operation.
    Info,
    /// Something went wrong but the app continues.
    Warn,
    /// An operation failed.
    Error,
}

impl LogLevel {
    /// Stable representation in the log file.
    pub fn as_str(self) -> &'static str {
        match self {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

/// A local, rotating log file.
#[derive(Debug, Clone)]
pub struct Logger {
    path: PathBuf,
    max_bytes: u64,
}

impl Logger {
    /// Opens (or prepares) the log file in a directory.
    pub fn new(directory: impl AsRef<Path>) -> CoreResult<Self> {
        let directory = directory.as_ref();
        std::fs::create_dir_all(directory)?;
        Ok(Logger {
            path: directory.join("socdof.log"),
            max_bytes: DEFAULT_MAX_BYTES,
        })
    }

    /// Uses a specific file instead of `<directory>/socdof.log`.
    pub fn at(path: impl Into<PathBuf>) -> Self {
        Logger {
            path: path.into(),
            max_bytes: DEFAULT_MAX_BYTES,
        }
    }

    /// Overrides the rotation threshold.
    pub fn with_max_bytes(mut self, max_bytes: u64) -> Self {
        self.max_bytes = max_bytes;
        self
    }

    /// Path of the active log file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Writes a debug line.
    pub fn debug(&self, message: &str, now: i64) -> CoreResult<()> {
        self.log(LogLevel::Debug, message, now)
    }

    /// Writes an info line.
    pub fn info(&self, message: &str, now: i64) -> CoreResult<()> {
        self.log(LogLevel::Info, message, now)
    }

    /// Writes a warning line.
    pub fn warn(&self, message: &str, now: i64) -> CoreResult<()> {
        self.log(LogLevel::Warn, message, now)
    }

    /// Writes an error line.
    pub fn error(&self, message: &str, now: i64) -> CoreResult<()> {
        self.log(LogLevel::Error, message, now)
    }

    /// Appends one JSON line.
    pub fn log(&self, level: LogLevel, message: &str, now: i64) -> CoreResult<()> {
        self.rotate_if_needed()?;

        let line = serde_json::to_string(&json!({
            "ts": now,
            "level": level.as_str(),
            "message": message,
        }))?;

        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        writeln!(file, "{line}")?;
        Ok(())
    }

    /// Writes a crash report next to the log file and returns its path.
    pub fn log_crash(&self, report: &str, now: i64) -> CoreResult<PathBuf> {
        let directory = self.path.parent().unwrap_or_else(|| Path::new("."));
        let path = directory.join(format!("crash-{now}.log"));
        std::fs::write(
            &path,
            format!("SOCDOF crash report\ncreated_at: {now}\n\n{report}\n"),
        )?;
        Ok(path)
    }

    fn rotate_if_needed(&self) -> CoreResult<()> {
        let Ok(metadata) = std::fs::metadata(&self.path) else {
            return Ok(());
        };
        if metadata.len() < self.max_bytes {
            return Ok(());
        }

        let rotated = self.path.with_extension("log.1");
        let _ = std::fs::remove_file(&rotated);
        std::fs::rename(&self.path, &rotated)?;
        Ok(())
    }
}

/// Installs a panic hook that writes a crash report next to `log_path`.
///
/// The hook prints to stderr as before, so terminals and CI keep their output. Calling it more than
/// once has no effect.
pub fn install_panic_hook(log_path: PathBuf) {
    static PATH: OnceLock<PathBuf> = OnceLock::new();
    if PATH.set(log_path).is_err() {
        return;
    }

    std::panic::set_hook(Box::new(|info| {
        let message = info.to_string();
        if let Some(path) = PATH.get() {
            let directory = path.parent().map(Path::to_path_buf).unwrap_or_default();
            let now = crate::now_millis();
            let crash = directory.join(format!("crash-{now}.log"));
            let _ = std::fs::write(
                crash,
                format!("SOCDOF crash report\ncreated_at: {now}\n\n{message}\n"),
            );
        }
        eprintln!("{message}");
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn workspace() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-log-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn appends_json_lines() {
        let directory = workspace();
        let logger = Logger::new(&directory).expect("logger");

        logger.info("gestartet", 1_000).expect("info");
        logger.error("kaputt", 1_001).expect("error");

        let content = std::fs::read_to_string(logger.path()).expect("log");
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("\"level\":\"info\""));
        assert!(lines[1].contains("\"message\":\"kaputt\""));
        assert!(content.contains("\"ts\":1001"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn rotates_when_the_file_grows() {
        let directory = workspace();
        let logger = Logger::new(&directory).expect("logger").with_max_bytes(60);

        logger.info("erste Zeile", 1).expect("first");
        logger.info("zweite Zeile", 2).expect("second");
        logger.info("dritte Zeile", 3).expect("third");

        let rotated = logger.path().with_extension("log.1");
        assert!(rotated.exists(), "rotated file missing");
        assert!(std::fs::read_to_string(&rotated)
            .expect("rotated")
            .contains("erste Zeile"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn writes_a_local_crash_report() {
        let directory = workspace();
        let logger = Logger::new(&directory).expect("logger");

        let path = logger
            .log_crash("panicked at src/main.rs:1", 4_242)
            .expect("crash report");
        let content = std::fs::read_to_string(path).expect("report");
        assert!(content.contains("SOCDOF crash report"));
        assert!(content.contains("src/main.rs:1"));

        let _ = std::fs::remove_dir_all(directory);
    }
}
