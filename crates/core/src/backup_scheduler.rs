//! Backup scheduler: decides when a backup is due and prunes old archives.
//!
//! The scheduler is deliberately stateless. It derives everything from the company profile and the
//! backups already in the target folder, so a restart cannot lose the schedule and a second process
//! cannot write a duplicate backup just because it forgot the last run.

use std::path::{Path, PathBuf};

use crate::backup;
use crate::domain::settings::CompanyProfile;
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// File name prefix of a scheduled backup.
pub const FILE_PREFIX: &str = "socdof-backup-";
/// File name suffix of a scheduled backup.
pub const FILE_SUFFIX: &str = ".socdofbak";

/// Backup settings resolved from the company profile.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupSchedule {
    /// Whether automatic backups are on.
    pub enabled: bool,
    /// Target folder.
    pub folder: PathBuf,
    /// Minutes between two backups.
    pub interval_minutes: i64,
    /// Number of archives to keep.
    pub keep: i64,
}

/// A backup that the scheduler wrote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScheduledBackup {
    /// Path of the archive.
    pub path: PathBuf,
    /// Size of the archive in bytes.
    pub archive_bytes: u64,
    /// Number of old archives that were pruned.
    pub pruned: usize,
}

impl BackupSchedule {
    /// Reads the schedule from the company profile.
    ///
    /// Automatic backups need a folder; without one the schedule is disabled even if the toggle is
    /// on, because there is nowhere to write.
    pub fn from_profile(profile: &CompanyProfile) -> Self {
        let folder = PathBuf::from(profile.backup_folder_path.trim());
        BackupSchedule {
            enabled: profile.auto_backup_enabled && !folder.as_os_str().is_empty(),
            folder,
            interval_minutes: profile.backup_interval_minutes,
            keep: profile.backup_max_keep_count,
        }
    }

    /// Validates the settings that are used when the schedule is enabled.
    pub fn validate(&self) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }
        if self.interval_minutes < 1 {
            return Err("backup_interval_invalid".to_string());
        }
        if self.keep < 1 {
            return Err("backup_keep_invalid".to_string());
        }
        Ok(())
    }

    /// Whether a backup is due at `now`.
    pub fn is_due(&self, last_backup_at: Option<i64>, now: i64) -> bool {
        if !self.enabled {
            return false;
        }
        match last_backup_at {
            None => true,
            Some(last) => now.saturating_sub(last) >= self.interval_minutes.saturating_mul(60_000),
        }
    }
}

/// Writes a backup if one is due, then prunes old archives.
pub fn run_if_due(
    store: &Store,
    schedule: &BackupSchedule,
    last_backup_at: Option<i64>,
    app_version: &str,
    now: i64,
) -> CoreResult<Option<ScheduledBackup>> {
    if !schedule.is_due(last_backup_at, now) {
        return Ok(None);
    }
    schedule.validate().map_err(CoreError::Validation)?;

    std::fs::create_dir_all(&schedule.folder)?;
    let path = schedule
        .folder
        .join(format!("{FILE_PREFIX}{now}{FILE_SUFFIX}"));
    let info = backup::create_backup(store, &path, app_version, now)?;
    let pruned = prune(&schedule.folder, schedule.keep as usize)?;

    Ok(Some(ScheduledBackup {
        path,
        archive_bytes: info.archive_bytes,
        pruned,
    }))
}

/// Creation time of the newest archive in a folder, if there is one.
pub fn last_backup_at(folder: &Path) -> CoreResult<Option<i64>> {
    Ok(list_backups(folder)?.last().copied())
}

/// Removes all but the newest `keep` archives and returns how many were deleted.
pub fn prune(folder: &Path, keep: usize) -> CoreResult<usize> {
    let archives = list_archives(folder)?;
    let remove = archives.len().saturating_sub(keep);
    let mut removed = 0;

    for (path, _) in archives.into_iter().take(remove) {
        std::fs::remove_file(path)?;
        removed += 1;
    }

    Ok(removed)
}

fn list_backups(folder: &Path) -> CoreResult<Vec<i64>> {
    Ok(list_archives(folder)?
        .into_iter()
        .map(|(_, timestamp)| timestamp)
        .collect())
}

fn list_archives(folder: &Path) -> CoreResult<Vec<(PathBuf, i64)>> {
    if !folder.is_dir() {
        return Ok(Vec::new());
    }

    let mut archives = Vec::new();
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(rest) = name.strip_prefix(FILE_PREFIX) else {
            continue;
        };
        let Some(rest) = rest.strip_suffix(FILE_SUFFIX) else {
            continue;
        };
        let Ok(timestamp) = rest.parse::<i64>() else {
            continue;
        };
        archives.push((path, timestamp));
    }

    archives.sort_by_key(|(_, timestamp)| *timestamp);
    Ok(archives)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::settings::CompanyProfile;
    use uuid::Uuid;

    fn profile(folder: &Path, interval: i64, keep: i64) -> CompanyProfile {
        CompanyProfile {
            auto_backup_enabled: true,
            backup_folder_path: folder.to_string_lossy().to_string(),
            backup_interval_minutes: interval,
            backup_max_keep_count: keep,
            ..CompanyProfile::default()
        }
    }

    fn workspace() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-schedule-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn decides_when_a_backup_is_due() {
        let directory = workspace();
        let schedule = BackupSchedule::from_profile(&profile(&directory, 60, 5));

        assert!(schedule.enabled);
        assert!(schedule.is_due(None, 0));
        assert!(!schedule.is_due(Some(0), 30 * 60_000));
        assert!(schedule.is_due(Some(0), 60 * 60_000));

        let disabled = BackupSchedule::from_profile(&CompanyProfile::default());
        assert!(!disabled.enabled);
        assert!(!disabled.is_due(None, 0));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn writes_and_prunes_scheduled_backups() {
        let directory = workspace();
        let store = Store::open_in_memory().expect("store");
        let schedule = BackupSchedule::from_profile(&profile(&directory, 1, 2));

        assert!(run_if_due(&store, &schedule, Some(1_000), "0.3.0", 1_000)
            .expect("due")
            .is_none());

        let first = run_if_due(&store, &schedule, None, "0.3.0", 10_000)
            .expect("backup")
            .expect("written");
        assert!(first.path.exists());
        assert_eq!(last_backup_at(&directory).expect("last"), Some(10_000));

        for offset in 1..3 {
            run_if_due(&store, &schedule, None, "0.3.0", 10_000 + offset)
                .expect("backup")
                .expect("written");
        }

        let archives = list_archives(&directory).expect("archives");
        assert_eq!(archives.len(), 2);
        assert_eq!(archives[1].1, 10_002);

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn rejects_invalid_schedule_settings() {
        let mut schedule = BackupSchedule::from_profile(&profile(Path::new("/tmp/socdof"), 0, 5));
        assert_eq!(
            schedule.validate(),
            Err("backup_interval_invalid".to_string())
        );

        schedule.interval_minutes = 60;
        schedule.keep = 0;
        assert_eq!(schedule.validate(), Err("backup_keep_invalid".to_string()));
    }
}
