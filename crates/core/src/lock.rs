//! Single instance / network share lock.
//!
//! The lock is a small JSON file that is created atomically. A second start reads the file and is
//! rejected while the heartbeat is fresh. If the owning process crashed, the heartbeat ages and the
//! lock is taken over instead of blocking the application forever.

use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::now_millis;

/// A lock older than this is considered abandoned.
pub const DEFAULT_STALE_AFTER_MS: i64 = 30_000;

/// File name of the shared-folder lock.
///
/// The legacy Electron app writes the same file next to its data, so both builds exclude each other
/// during a dual-run period. The JSON keys below are the legacy ones (`hostname`, `username`,
/// `heartbeat`, `requestQuit`), which keeps the file readable in both directions.
pub const LOCK_FILE_NAME: &str = "network_session.lock";

/// Data written into the lock file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LockInfo {
    /// Process identifier of the owning instance.
    pub pid: u32,
    /// Operating system user name (`username` in the legacy format).
    #[serde(rename = "username", alias = "user")]
    pub user: String,
    /// Machine name (`hostname` in the legacy format).
    #[serde(rename = "hostname", alias = "machine")]
    pub machine: String,
    /// When the instance started, in milliseconds since the Unix epoch.
    ///
    /// The legacy app writes an ISO timestamp here, which is read as `0`: only the heartbeat decides
    /// whether a lock is alive.
    #[serde(
        rename = "startTime",
        default,
        deserialize_with = "de_started_at",
        skip_serializing_if = "is_zero"
    )]
    pub started_at: i64,
    /// Last heartbeat, in milliseconds since the Unix epoch (`heartbeat` in the legacy format).
    #[serde(rename = "heartbeat", alias = "heartbeat_at")]
    pub heartbeat_at: i64,
    /// Set by the legacy app when it wants the other instance to quit.
    #[serde(rename = "requestQuit", default)]
    pub request_quit: bool,
}

/// Held lock. Releasing happens on drop, so a normal exit always frees the file.
#[derive(Debug)]
pub struct InstanceLock {
    path: PathBuf,
    info: LockInfo,
}

impl InstanceLock {
    /// Acquires the lock at `path`, using the current time and the default stale timeout.
    pub fn acquire(path: impl AsRef<Path>) -> CoreResult<Self> {
        Self::acquire_with(path, now_millis(), DEFAULT_STALE_AFTER_MS)
    }

    /// Acquires the lock with an explicit clock and stale timeout. Used by tests.
    pub fn acquire_with(path: impl AsRef<Path>, now: i64, stale_after_ms: i64) -> CoreResult<Self> {
        let path = path.as_ref().to_path_buf();
        let info = LockInfo {
            pid: std::process::id(),
            user: env_value("USER", "USERNAME"),
            machine: env_value("HOSTNAME", "COMPUTERNAME"),
            started_at: now,
            heartbeat_at: now,
            request_quit: false,
        };

        match create_lock_file(&path, &info) {
            Ok(()) => Ok(InstanceLock { path, info }),
            Err(CoreError::Validation(code)) if code == "lock_busy" => {
                if !is_stale(&path, now, stale_after_ms)? {
                    return Err(CoreError::Validation("lock_busy".to_string()));
                }

                // Take over an abandoned lock. A concurrent starter may win the race, which is fine:
                // the create_new below stays atomic.
                let _ = std::fs::remove_file(&path);
                create_lock_file(&path, &info)?;
                Ok(InstanceLock { path, info })
            }
            Err(error) => Err(error),
        }
    }

    /// Refreshes the heartbeat so other instances see the lock as alive.
    pub fn heartbeat(&mut self, now: i64) -> CoreResult<()> {
        self.info.heartbeat_at = now;
        let text = serde_json::to_string(&self.info)?;
        std::fs::write(&self.path, text)?;
        Ok(())
    }

    /// Reader of the current owner, if the lock file is readable.
    pub fn owner(&self) -> Option<LockInfo> {
        read_info(&self.path).ok().flatten()
    }

    /// Path of the lock file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Takes the lock even when the current heartbeat is fresh.
    ///
    /// This is what the interactive takeover dialog calls after the user confirmed it: on a shared
    /// folder a hanging window cannot refresh its heartbeat, and waiting for the stale timeout is not
    /// always an option.
    pub fn force_takeover(path: impl AsRef<Path>, now: i64) -> CoreResult<Self> {
        let path = path.as_ref().to_path_buf();
        let info = LockInfo {
            pid: std::process::id(),
            user: env_value("USER", "USERNAME"),
            machine: env_value("HOSTNAME", "COMPUTERNAME"),
            started_at: now,
            heartbeat_at: now,
            request_quit: false,
        };
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(CoreError::Io(error)),
        }
        create_lock_file(&path, &info)?;
        Ok(InstanceLock { path, info })
    }

    /// Reads the owner of a lock file without acquiring it.
    pub fn inspect(path: impl AsRef<Path>) -> CoreResult<Option<LockInfo>> {
        read_info(path.as_ref())
    }

    /// Removes the lock file now, when it still belongs to this instance.
    ///
    /// `Drop` does the same, but a window layer can exit through a path that skips destructors
    /// (for example `app.exit`); releasing explicitly keeps an immediate restart possible.
    pub fn release(&self) {
        remove_owned(&self.path, &self.info);
    }
}

impl Drop for InstanceLock {
    fn drop(&mut self) {
        // Only remove the file when it still belongs to this instance; a takeover must not be undone.
        remove_owned(&self.path, &self.info);
    }
}

/// Removes `path` when it still belongs to `info`; a takeover must not be undone.
fn remove_owned(path: &Path, info: &LockInfo) {
    match read_info(path) {
        Ok(Some(owner)) if owner.pid == info.pid && owner.started_at == info.started_at => {
            let _ = std::fs::remove_file(path);
        }
        Ok(Some(_)) => {}
        _ => {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn create_lock_file(path: &Path, info: &LockInfo) -> CoreResult<()> {
    let text = serde_json::to_string(info)?;
    let mut file = match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(CoreError::Validation("lock_busy".to_string()));
        }
        Err(error) => return Err(CoreError::Io(error)),
    };

    file.write_all(text.as_bytes())?;
    file.sync_all()?;
    Ok(())
}

fn read_info(path: &Path) -> CoreResult<Option<LockInfo>> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(CoreError::Io(error)),
    };

    Ok(serde_json::from_str(&text).ok())
}

fn is_stale(path: &Path, now: i64, stale_after_ms: i64) -> CoreResult<bool> {
    match read_info(path)? {
        Some(info) => {
            // A lock from a process that no longer exists on this machine is abandoned even when
            // its heartbeat is fresh: an `app.exit` path skips destructors and would otherwise
            // block the next start for the whole stale timeout.
            if info.machine == env_value("HOSTNAME", "COMPUTERNAME")
                && pid_is_alive(info.pid) == Some(false)
            {
                return Ok(true);
            }
            Ok(now.saturating_sub(info.heartbeat_at) > stale_after_ms)
        }
        // Unreadable or empty file: treat it as abandoned.
        None => Ok(true),
    }
}

/// Whether `pid` still runs, when the platform can answer that cheaply.
fn pid_is_alive(pid: u32) -> Option<bool> {
    #[cfg(target_os = "linux")]
    {
        Some(Path::new(&format!("/proc/{pid}")).exists())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = pid;
        None
    }
}

fn de_started_at<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum NumberOrText {
        Number(i64),
        Text(String),
    }

    Ok(match NumberOrText::deserialize(deserializer)? {
        NumberOrText::Number(value) => value,
        NumberOrText::Text(text) => text.parse::<i64>().unwrap_or(0),
    })
}

fn is_zero(value: &i64) -> bool {
    *value == 0
}

fn env_value(primary: &str, fallback: &str) -> String {
    std::env::var(primary)
        .or_else(|_| std::env::var(fallback))
        .unwrap_or_else(|_| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-lock-{tag}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn rejects_a_second_instance_and_releases_on_drop() {
        let dir = temp_dir("contention");
        let path = dir.join("socdof.lock");

        let first =
            InstanceLock::acquire_with(&path, 1_000, DEFAULT_STALE_AFTER_MS).expect("first");
        let second = InstanceLock::acquire_with(&path, 1_001, DEFAULT_STALE_AFTER_MS);
        assert!(matches!(second, Err(CoreError::Validation(code)) if code == "lock_busy"));

        drop(first);

        let third =
            InstanceLock::acquire_with(&path, 1_002, DEFAULT_STALE_AFTER_MS).expect("released");
        assert_eq!(third.owner().map(|info| info.pid), Some(std::process::id()));
        drop(third);
        assert!(!path.exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn keeps_the_lock_alive_with_heartbeats() {
        let dir = temp_dir("heartbeat");
        let path = dir.join("socdof.lock");

        let mut lock = InstanceLock::acquire_with(&path, 1_000, 30_000).expect("lock");
        lock.heartbeat(40_000).expect("heartbeat");

        let second = InstanceLock::acquire_with(&path, 45_000, 30_000);
        assert!(matches!(second, Err(CoreError::Validation(code)) if code == "lock_busy"));

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn takes_over_an_abandoned_lock() {
        let dir = temp_dir("stale");
        let path = dir.join("socdof.lock");

        let crashed = LockInfo {
            pid: 999_999,
            user: "someone".to_string(),
            machine: "other-pc".to_string(),
            started_at: 1_000,
            heartbeat_at: 1_000,
            request_quit: false,
        };
        std::fs::write(&path, serde_json::to_string(&crashed).expect("json")).expect("lock file");

        let lock = InstanceLock::acquire_with(&path, 100_000, 30_000).expect("takeover");
        let owner = lock.owner().expect("owner");
        assert_eq!(owner.pid, std::process::id());
        assert_eq!(owner.heartbeat_at, 100_000);

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    fn legacy_file(dir: &Path, heartbeat_at: i64) -> PathBuf {
        let path = dir.join(LOCK_FILE_NAME);
        let text = format!(
            r#"{{"hostname":"legacy-pc","username":"legacy-user","pid":4242,
                "startTime":"2026-11-07T10:00:00.000Z","heartbeat":{heartbeat_at},"requestQuit":false}}"#
        );
        std::fs::write(&path, text).expect("legacy lock");
        path
    }

    #[test]
    fn honours_a_fresh_lock_from_the_legacy_app() {
        let dir = temp_dir("legacy-fresh");
        let path = legacy_file(&dir, 1_000);

        let second = InstanceLock::acquire_with(&path, 1_500, 30_000);
        assert!(matches!(second, Err(CoreError::Validation(code)) if code == "lock_busy"));

        let owner = InstanceLock::inspect(&path)
            .expect("inspect")
            .expect("owner");
        assert_eq!(owner.pid, 4242);
        assert_eq!(owner.machine, "legacy-pc");
        assert_eq!(owner.heartbeat_at, 1_000);
        assert_eq!(owner.started_at, 0, "ISO startTime is read as zero");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn takes_over_a_stale_legacy_lock() {
        let dir = temp_dir("legacy-stale");
        let path = legacy_file(&dir, 1_000);

        let lock = InstanceLock::acquire_with(&path, 100_000, 30_000).expect("takeover");
        assert_eq!(lock.owner().expect("owner").pid, std::process::id());

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn forced_takeover_wins_against_a_fresh_heartbeat() {
        let dir = temp_dir("forced");
        let path = legacy_file(&dir, 1_000);
        let blocked = InstanceLock::acquire_with(&path, 1_100, 30_000);
        assert!(matches!(blocked, Err(CoreError::Validation(code)) if code == "lock_busy"));

        let lock = InstanceLock::force_takeover(&path, 1_200).expect("forced takeover");
        let owner = lock.owner().expect("owner");
        assert_eq!(owner.pid, std::process::id());
        assert_eq!(owner.heartbeat_at, 1_200);

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn writes_the_keys_the_legacy_app_reads() {
        let dir = temp_dir("roundtrip");
        let path = dir.join(LOCK_FILE_NAME);
        let lock = InstanceLock::acquire_with(&path, 2_000, 30_000).expect("lock");

        let text = std::fs::read_to_string(&path).expect("lock file");
        for key in [
            "\"hostname\"",
            "\"username\"",
            "\"pid\"",
            "\"heartbeat\"",
            "\"requestQuit\"",
        ] {
            assert!(text.contains(key), "missing {key} in {text}");
        }

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn takes_over_a_lock_from_a_dead_local_process() {
        let dir = temp_dir("dead-local");
        let path = dir.join("socdof.lock");
        let dead = LockInfo {
            pid: 999_999,
            user: "someone".to_string(),
            machine: env_value("HOSTNAME", "COMPUTERNAME"),
            started_at: 1_000,
            heartbeat_at: 1_000,
            request_quit: false,
        };
        std::fs::write(&path, serde_json::to_string(&dead).expect("json")).expect("lock file");

        // The heartbeat still looks fresh; only the dead pid reveals the abandoned lock.
        let lock = InstanceLock::acquire_with(&path, 1_100, 30_000).expect("dead owner takeover");
        assert_eq!(lock.owner().expect("owner").pid, std::process::id());

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn keeps_a_fresh_lock_from_a_live_local_process() {
        let dir = temp_dir("live-local");
        let path = dir.join("socdof.lock");

        let mut lock = InstanceLock::acquire_with(&path, 1_000, 30_000).expect("first");
        lock.heartbeat(1_000).expect("heartbeat");

        let second = InstanceLock::acquire_with(&path, 1_100, 30_000);
        assert!(matches!(second, Err(CoreError::Validation(code)) if code == "lock_busy"));

        drop(lock);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn treats_unreadable_lock_files_as_abandoned() {
        let dir = temp_dir("garbage");
        let path = dir.join("socdof.lock");
        std::fs::write(&path, b"not json").expect("garbage file");

        let lock = InstanceLock::acquire_with(&path, 1_000, 30_000).expect("takeover");
        drop(lock);

        let _ = std::fs::remove_dir_all(dir);
    }
}
