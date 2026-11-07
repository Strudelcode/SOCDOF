//! Backup container.
//!
//! A backup is a single file with a small binary header and a JSON metadata block followed by a
//! consistent copy of the SQLite database:
//!
//! ```text
//! magic "SOCDOFBK" | format u32 | meta_len u32 | meta JSON | payload_len u64 | crc32 u32 | payload
//! ```
//!
//! The checksum covers the database payload only, so a damaged archive is detected before anything
//! is written over a live database.

use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::store::Store;

const MAGIC: &[u8; 8] = b"SOCDOFBK";
const HEADER_LEN: usize = MAGIC.len() + 4 + 4;

/// Layout version of the container. Bump when the header changes.
pub const FORMAT_VERSION: u32 = 1;

/// Metadata stored inside every archive.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupMetadata {
    /// Container layout version.
    pub format_version: u32,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Schema version of the contained database.
    pub schema_version: i64,
    /// Application version that wrote the archive.
    pub app_version: String,
}

/// Result of writing a backup.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupInfo {
    /// Metadata written into the archive.
    pub metadata: BackupMetadata,
    /// Size of the archive file in bytes.
    pub archive_bytes: u64,
    /// Size of the contained database in bytes.
    pub database_bytes: u64,
}

/// A parsed archive.
#[derive(Debug, Clone)]
pub struct Backup {
    /// Metadata of the archive.
    pub metadata: BackupMetadata,
    /// Raw SQLite database bytes.
    pub payload: Vec<u8>,
}

/// Writes a consistent copy of the open store into a backup archive.
///
/// The database is snapshotted with `VACUUM INTO`, so the archive never contains a half-written
/// transaction, even while the application is running.
pub fn create_backup(
    store: &Store,
    archive_path: &Path,
    app_version: &str,
    now: i64,
) -> CoreResult<BackupInfo> {
    let snapshot = std::env::temp_dir().join(format!("socdof-snapshot-{}.db", Uuid::new_v4()));
    store.snapshot_to(&snapshot)?;

    let payload = std::fs::read(&snapshot)?;
    let _ = std::fs::remove_file(&snapshot);

    let metadata = BackupMetadata {
        format_version: FORMAT_VERSION,
        created_at: now,
        schema_version: store.schema_version()?,
        app_version: app_version.to_string(),
    };
    let meta_bytes = serde_json::to_vec(&metadata)?;

    let mut archive = Vec::with_capacity(payload.len() + meta_bytes.len() + HEADER_LEN + 12);
    archive.extend_from_slice(MAGIC);
    archive.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
    archive.extend_from_slice(&(meta_bytes.len() as u32).to_le_bytes());
    archive.extend_from_slice(&meta_bytes);
    archive.extend_from_slice(&(payload.len() as u64).to_le_bytes());
    archive.extend_from_slice(&crc32(&payload).to_le_bytes());
    archive.extend_from_slice(&payload);

    std::fs::write(archive_path, &archive)?;

    Ok(BackupInfo {
        metadata,
        archive_bytes: archive.len() as u64,
        database_bytes: payload.len() as u64,
    })
}

/// Reads and validates an archive. Nothing is written.
pub fn read_backup(archive_path: &Path) -> CoreResult<Backup> {
    let bytes = std::fs::read(archive_path)?;
    parse_archive(&bytes)
}

/// Restores an archive over an existing database file.
///
/// The store must be closed by the caller before restoring; afterwards the file is replaced
/// atomically and stale `-wal`/`-shm` sidecars are removed.
pub fn restore_backup(archive_path: &Path, database_path: &Path) -> CoreResult<BackupMetadata> {
    let backup = read_backup(archive_path)?;

    let temporary = database_path.with_extension(format!("restore-{}", Uuid::new_v4()));
    std::fs::write(&temporary, &backup.payload)?;

    if let Err(error) = std::fs::rename(&temporary, database_path) {
        if database_path.exists() {
            std::fs::remove_file(database_path)?;
            std::fs::rename(&temporary, database_path)?;
        } else {
            return Err(CoreError::Io(error));
        }
    }

    for suffix in ["-wal", "-shm"] {
        let sidecar = format!("{}{suffix}", database_path.display());
        let _ = std::fs::remove_file(sidecar);
    }

    Ok(backup.metadata)
}

fn parse_archive(bytes: &[u8]) -> CoreResult<Backup> {
    if bytes.len() < HEADER_LEN {
        return Err(CoreError::Validation("backup_truncated".to_string()));
    }
    if &bytes[..MAGIC.len()] != MAGIC {
        return Err(CoreError::Validation("backup_invalid_format".to_string()));
    }

    let mut cursor = MAGIC.len();
    let format_version = read_u32(bytes, &mut cursor)?;
    if format_version != FORMAT_VERSION {
        return Err(CoreError::Validation(
            "backup_unsupported_version".to_string(),
        ));
    }

    let meta_len = read_u32(bytes, &mut cursor)? as usize;
    let meta_bytes = read_slice(bytes, &mut cursor, meta_len)?;
    let metadata: BackupMetadata = serde_json::from_slice(meta_bytes)
        .map_err(|_| CoreError::Validation("backup_corrupt".to_string()))?;

    let payload_len = read_u64(bytes, &mut cursor)? as usize;
    let expected_crc = read_u32(bytes, &mut cursor)?;
    let payload = read_slice(bytes, &mut cursor, payload_len)?;

    if crc32(payload) != expected_crc || metadata.format_version != FORMAT_VERSION {
        return Err(CoreError::Validation("backup_corrupt".to_string()));
    }

    Ok(Backup {
        metadata,
        payload: payload.to_vec(),
    })
}

fn read_slice<'a>(bytes: &'a [u8], cursor: &mut usize, len: usize) -> CoreResult<&'a [u8]> {
    let end = cursor
        .checked_add(len)
        .ok_or_else(|| CoreError::Validation("backup_truncated".to_string()))?;
    if end > bytes.len() {
        return Err(CoreError::Validation("backup_truncated".to_string()));
    }
    let slice = &bytes[*cursor..end];
    *cursor = end;
    Ok(slice)
}

fn read_u32(bytes: &[u8], cursor: &mut usize) -> CoreResult<u32> {
    let slice = read_slice(bytes, cursor, 4)?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], cursor: &mut usize) -> CoreResult<u64> {
    let slice = read_slice(bytes, cursor, 8)?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

/// CRC-32 (IEEE 802.3), enough to detect damaged or truncated archives.
fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for byte in data {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::{Contact, ContactKind};
    use crate::now_millis;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("socdof-backup-{tag}-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn crc32_matches_the_reference_value() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn roundtrips_a_database_through_an_archive() {
        let dir = temp_dir("roundtrip");
        let database = dir.join("socdof.db");
        let archive = dir.join("backup.socdofbak");

        {
            let store = Store::open(&database).expect("store");
            let mut contact = Contact::new(ContactKind::Company, now_millis());
            contact.company_name = Some("Strudelcode".to_string());
            contact.city = Some("Bozen".to_string());
            store.insert_contact(&contact).expect("contact inserted");
        }

        let info = {
            let store = Store::open(&database).expect("store");
            create_backup(&store, &archive, "0.1.0", 1_700_000_000_000).expect("backup created")
        };
        assert_eq!(info.metadata.schema_version, crate::store::SCHEMA_VERSION);
        assert_eq!(info.metadata.app_version, "0.1.0");
        assert!(info.archive_bytes > info.database_bytes);

        // Destroy the live database to prove the restore really brings the data back.
        std::fs::write(&database, b"this is not a database").expect("database destroyed");

        let metadata = restore_backup(&archive, &database).expect("restored");
        assert_eq!(metadata.created_at, 1_700_000_000_000);

        let store = Store::open(&database).expect("store reopened");
        let contacts = store.list_contacts().expect("list");
        assert_eq!(contacts.len(), 1);
        assert_eq!(contacts[0].company_name.as_deref(), Some("Strudelcode"));
        assert_eq!(contacts[0].city.as_deref(), Some("Bozen"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_damaged_archives() {
        let dir = temp_dir("damaged");
        let database = dir.join("socdof.db");
        let archive = dir.join("backup.socdofbak");

        {
            let store = Store::open(&database).expect("store");
            create_backup(&store, &archive, "0.1.0", now_millis()).expect("backup created");
        }

        let original = std::fs::read(&archive).expect("archive read");

        let mut damaged = original.clone();
        let last = damaged.len() - 1;
        damaged[last] ^= 0xFF;
        std::fs::write(&archive, &damaged).expect("damaged archive written");

        let error = restore_backup(&archive, &database).expect_err("must be rejected");
        assert!(matches!(error, CoreError::Validation(code) if code == "backup_corrupt"));

        // The database must be untouched when the archive is rejected.
        let store = Store::open(&database).expect("store still usable");
        assert_eq!(
            store.schema_version().expect("version"),
            crate::store::SCHEMA_VERSION
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_foreign_and_truncated_files() {
        let dir = temp_dir("foreign");
        let archive = dir.join("foreign.bin");
        let database = dir.join("socdof.db");

        std::fs::write(&archive, vec![0u8; 128]).expect("foreign file");
        let error = restore_backup(&archive, &database).expect_err("must be rejected");
        assert!(matches!(error, CoreError::Validation(code) if code == "backup_invalid_format"));

        std::fs::write(&archive, b"SOCDOFBK\x01\x00").expect("truncated file");
        let error = restore_backup(&archive, &database).expect_err("must be rejected");
        assert!(matches!(error, CoreError::Validation(code) if code == "backup_truncated"));

        let _ = std::fs::remove_dir_all(dir);
    }
}
