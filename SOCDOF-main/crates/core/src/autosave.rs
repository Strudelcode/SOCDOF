//! Autosave snapshots.
//!
//! A snapshot is a normal backup container written into an `autosave` folder. The archive is
//! created and verified first and only then renamed into place, so a crash during the write never
//! leaves a half-written file that looks like a valid snapshot. Old snapshots are pruned by count.

use std::path::{Path, PathBuf};

use serde::Serialize;
use uuid::Uuid;

use crate::backup::{self, BackupMetadata};
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// File name prefix of an autosave snapshot.
pub const FILE_PREFIX: &str = "autosave-";
/// File name suffix of an autosave snapshot.
pub const FILE_SUFFIX: &str = ".socdofbak";
/// Snapshots kept by default.
pub const DEFAULT_KEEP: usize = 5;

/// One snapshot on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SnapshotInfo {
    /// Full path of the archive.
    pub path: PathBuf,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Size of the archive file in bytes.
    pub bytes: u64,
}

/// Writes a snapshot and prunes older ones.
///
/// `keep` counts the snapshots that remain after the write, including the new one.
pub fn write_snapshot(
    store: &Store,
    directory: &Path,
    app_version: &str,
    now: i64,
    keep: usize,
) -> CoreResult<SnapshotInfo> {
    std::fs::create_dir_all(directory)?;

    let target = directory.join(format!("{FILE_PREFIX}{now}{FILE_SUFFIX}"));
    let temporary = directory.join(format!(".autosave-{}.tmp", Uuid::new_v4()));

    let info = match backup::create_backup(store, &temporary, app_version, now) {
        Ok(info) => info,
        Err(error) => {
            let _ = std::fs::remove_file(&temporary);
            return Err(error);
        }
    };

    if let Err(error) = std::fs::rename(&temporary, &target) {
        let _ = std::fs::remove_file(&temporary);
        return Err(CoreError::Io(error));
    }

    prune(directory, keep)?;

    Ok(SnapshotInfo {
        path: target,
        created_at: now,
        bytes: info.archive_bytes,
    })
}

/// Lists the snapshots of a folder, oldest first. A missing folder is empty, not an error.
pub fn list_snapshots(directory: &Path) -> CoreResult<Vec<SnapshotInfo>> {
    if !directory.is_dir() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    for entry in std::fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(timestamp) = timestamp_from_name(name) else {
            continue;
        };

        snapshots.push(SnapshotInfo {
            path: path.clone(),
            created_at: timestamp,
            bytes: entry.metadata().map(|meta| meta.len()).unwrap_or(0),
        });
    }

    snapshots.sort_by_key(|snapshot| snapshot.created_at);
    Ok(snapshots)
}

/// Newest snapshot of a folder.
pub fn latest_snapshot(directory: &Path) -> CoreResult<Option<SnapshotInfo>> {
    Ok(list_snapshots(directory)?.pop())
}

/// Removes all but the newest `keep` snapshots and returns how many were deleted.
pub fn prune(directory: &Path, keep: usize) -> CoreResult<usize> {
    let snapshots = list_snapshots(directory)?;
    let remove = snapshots.len().saturating_sub(keep);
    let mut removed = 0;

    for snapshot in snapshots.into_iter().take(remove) {
        std::fs::remove_file(&snapshot.path)?;
        removed += 1;
    }

    Ok(removed)
}

/// Restores a snapshot over a database file. The store must be closed by the caller.
pub fn restore_snapshot(snapshot: &Path, database: &Path) -> CoreResult<BackupMetadata> {
    backup::restore_backup(snapshot, database)
}

fn timestamp_from_name(name: &str) -> Option<i64> {
    let rest = name.strip_prefix(FILE_PREFIX)?.strip_suffix(FILE_SUFFIX)?;
    rest.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::{Contact, ContactKind};
    use crate::now_millis;

    fn workspace() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-autosave-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn writes_lists_and_prunes_snapshots() {
        let directory = workspace();
        let store = Store::open_in_memory().expect("store");

        for offset in 0..3 {
            write_snapshot(&store, &directory, "0.3.0", 1_000 + offset, 2).expect("snapshot");
        }

        let snapshots = list_snapshots(&directory).expect("list");
        assert_eq!(snapshots.len(), 2);
        assert_eq!(snapshots[1].created_at, 1_002);
        assert_eq!(
            latest_snapshot(&directory)
                .expect("latest")
                .expect("one")
                .created_at,
            1_002
        );
        assert_eq!(prune(&directory, 0).expect("pruned"), 2);
        assert!(list_snapshots(&directory).expect("list").is_empty());

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn restores_a_snapshot_into_a_fresh_database() {
        let directory = workspace();
        let database = directory.join("restore.db");
        let store = Store::open(&database).expect("store");

        let mut contact = Contact::new(ContactKind::Company, now_millis());
        contact.company_name = Some("Autosave Kunde".to_string());
        store.insert_contact(&contact).expect("contact");

        let snapshot = write_snapshot(&store, &directory, "0.3.0", now_millis(), DEFAULT_KEEP)
            .expect("snapshot");
        drop(store);

        std::fs::write(&database, b"broken").expect("database broken");
        restore_snapshot(&snapshot.path, &database).expect("restored");

        let store = Store::open(&database).expect("reopened");
        assert_eq!(store.list_contacts().expect("contacts").len(), 1);

        let _ = std::fs::remove_dir_all(directory);
    }
}
