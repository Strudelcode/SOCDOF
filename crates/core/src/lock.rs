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

/// Data written into the lock file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LockInfo {
    /// Process identifier of the owning instance.
    pub pid: u32,
    /// Operating system user name.
    pub user: String,
    /// Machine name.
    pub machine: String,
    /// When the instance started, in milliseconds since the Unix epoch.
    pub started_at: i64,
    /// Last heartbeat, in milliseconds since the Unix epoch.
    pub heartbeat_at: i64,
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
}

impl Drop for InstanceLock {
    fn drop(&mut self) {
        // Only remove the file when it still belongs to this instance; a takeover must not be undone.
        match read_info(&self.path) {
            Ok(Some(info))
                if info.pid == self.info.pid && info.started_at == self.info.started_at =>
            {
                let _ = std::fs::remove_file(&self.path);
            }
            Ok(Some(_)) => {}
            _ => {
                let _ = std::fs::remove_file(&self.path);
            }
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
        Some(info) => Ok(now.saturating_sub(info.heartbeat_at) > stale_after_ms),
        // Unreadable or empty file: treat it as abandoned.
        None => Ok(true),
    }
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
        };
        std::fs::write(&path, serde_json::to_string(&crashed).expect("json")).expect("lock file");

        let lock = InstanceLock::acquire_with(&path, 100_000, 30_000).expect("takeover");
        let owner = lock.owner().expect("owner");
        assert_eq!(owner.pid, std::process::id());
        assert_eq!(owner.heartbeat_at, 100_000);

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
