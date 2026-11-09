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

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::date::parse_iso8601;
use crate::error::{CoreError, CoreResult};
use crate::legacy;
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

/// A valid backup archive in a folder, as shown by the settings screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupFile {
    /// Full path of the archive.
    pub path: std::path::PathBuf,
    /// Metadata stored inside the archive.
    pub metadata: BackupMetadata,
    /// Size of the archive file in bytes.
    pub archive_bytes: u64,
}

/// Lists the valid `.socdofbak` archives in `folder`, newest first.
///
/// A missing folder is an empty list, not an error: the settings screen shows the empty state
/// before the first backup. Files that are not valid backup archives are skipped.
pub fn list_backups(folder: &Path) -> CoreResult<Vec<BackupFile>> {
    if !folder.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("socdofbak") {
            continue;
        }
        let Ok(backup) = read_backup(&path) else {
            continue;
        };
        let archive_bytes = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        backups.push(BackupFile {
            path,
            metadata: backup.metadata,
            archive_bytes,
        });
    }

    backups.sort_by(|left, right| {
        right
            .metadata
            .created_at
            .cmp(&left.metadata.created_at)
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(backups)
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
    if let Some(parent) = archive_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

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

    if let Some(parent) = database_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

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

/// File suffix of the legacy archive: the JSON document the TypeScript application writes.
pub const LEGACY_SUFFIX: &str = ".socdof.json";

/// Document version of the legacy exporter. The TypeScript app writes `version: 2`.
pub const LEGACY_DOCUMENT_VERSION: u64 = 2;

/// Which container a file on disk uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveKind {
    /// Native container with the `SOCDOFBK` header, metadata and checksum.
    Container,
    /// Legacy document written by the TypeScript exporter.
    LegacyJson,
}

impl ArchiveKind {
    /// Stable name for logs and the CLI.
    pub fn as_str(self) -> &'static str {
        match self {
            ArchiveKind::Container => "container",
            ArchiveKind::LegacyJson => "legacy-json",
        }
    }
}

/// Header of a legacy archive, as the TypeScript application writes it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LegacyMetadata {
    /// Application marker of the document (`SOCDOF_Enterprise_Local_ERP`).
    pub app: String,
    /// Document version of the exporter.
    pub document_version: u64,
    /// `exported_at` in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// `backup_owner` of the document.
    pub owner: String,
    /// Contacts in the document.
    pub contacts: usize,
    /// Products in the document.
    pub products: usize,
    /// Invoices in the document.
    pub invoices: usize,
    /// Purchase orders in the document.
    pub purchases: usize,
}

/// A legacy archive on disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyArchive {
    /// Full path of the document.
    pub path: PathBuf,
    /// Header read from the document.
    pub metadata: LegacyMetadata,
    /// Size of the file in bytes.
    pub archive_bytes: u64,
}

/// An archive of either format.
#[derive(Debug, Clone)]
pub enum Archive {
    /// Native container.
    Container(BackupFile),
    /// Legacy `.socdof.json` document.
    Legacy(LegacyArchive),
}

impl Archive {
    /// Path of the archive.
    pub fn path(&self) -> &Path {
        match self {
            Archive::Container(file) => &file.path,
            Archive::Legacy(file) => &file.path,
        }
    }

    /// Format of the archive.
    pub fn kind(&self) -> ArchiveKind {
        match self {
            Archive::Container(_) => ArchiveKind::Container,
            Archive::Legacy(_) => ArchiveKind::LegacyJson,
        }
    }

    /// Creation time in milliseconds since the Unix epoch.
    pub fn created_at(&self) -> i64 {
        match self {
            Archive::Container(file) => file.metadata.created_at,
            Archive::Legacy(file) => file.metadata.created_at,
        }
    }

    /// Size of the archive file in bytes.
    pub fn archive_bytes(&self) -> u64 {
        match self {
            Archive::Container(file) => file.archive_bytes,
            Archive::Legacy(file) => file.archive_bytes,
        }
    }
}

/// Result of restoring an archive.
#[derive(Debug)]
pub enum Restore {
    /// A container replaced the database file; the metadata is its header.
    Container(BackupMetadata),
    /// A legacy document was imported into the database.
    Legacy {
        /// Header of the restored document.
        metadata: LegacyMetadata,
        /// Counts of the imported records.
        report: legacy::LegacyImportReport,
    },
}

/// True when the path names a legacy archive (`*.socdof.json`).
pub fn is_legacy_path(path: &Path) -> bool {
    path.to_string_lossy()
        .to_ascii_lowercase()
        .ends_with(LEGACY_SUFFIX)
}

/// Detects the archive format from the first bytes of a file.
///
/// The native container starts with its magic, the legacy document with `{`. Everything else is
/// rejected before any database is touched.
pub fn inspect_bytes(bytes: &[u8]) -> CoreResult<ArchiveKind> {
    if bytes.starts_with(MAGIC) {
        return Ok(ArchiveKind::Container);
    }
    match bytes.iter().find(|byte| !byte.is_ascii_whitespace()) {
        Some(b'{') => Ok(ArchiveKind::LegacyJson),
        Some(_) => Err(CoreError::Validation("backup_invalid_format".to_string())),
        None => Err(CoreError::Validation("backup_truncated".to_string())),
    }
}

/// Reads the header of a legacy archive from its bytes.
///
/// The document is the one `exportDatabaseToJson` writes: `app`, `version`, `exported_at`,
/// `backup_owner`, `data_summary` and the record arrays. The counts come from the arrays, so a
/// stale `data_summary` cannot report records the document does not contain.
pub fn legacy_metadata(bytes: &[u8]) -> CoreResult<LegacyMetadata> {
    let document: Value = serde_json::from_slice(bytes)
        .map_err(|_| CoreError::Validation("backup_invalid_format".to_string()))?;
    let object = document
        .as_object()
        .ok_or_else(|| CoreError::Validation("backup_invalid_format".to_string()))?;

    if let Some(app) = object.get("app").and_then(Value::as_str) {
        if app != legacy::LEGACY_APP {
            return Err(CoreError::Validation("backup_invalid_format".to_string()));
        }
    }

    let document_version = match object.get("version") {
        Some(value) => value
            .as_u64()
            .ok_or_else(|| CoreError::Validation("backup_invalid_format".to_string()))?,
        None => LEGACY_DOCUMENT_VERSION,
    };
    if document_version != LEGACY_DOCUMENT_VERSION {
        return Err(CoreError::Validation(
            "backup_unsupported_version".to_string(),
        ));
    }

    for required in ["contacts", "products", "invoices"] {
        if !object.get(required).is_some_and(Value::is_array) {
            return Err(CoreError::Validation("backup_invalid_format".to_string()));
        }
    }

    let created_at = match object.get("exported_at").and_then(Value::as_str) {
        Some(text) => parse_iso8601(text)
            .ok_or_else(|| CoreError::Validation("backup_corrupt".to_string()))?,
        None => 0,
    };

    Ok(LegacyMetadata {
        app: legacy::LEGACY_APP.to_string(),
        document_version,
        created_at,
        owner: object
            .get("backup_owner")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        contacts: array_len(object.get("contacts")),
        products: array_len(object.get("products")),
        invoices: array_len(object.get("invoices")),
        purchases: array_len(object.get("purchase_orders")),
    })
}

/// Reads the header of a legacy archive from disk.
pub fn read_legacy_archive(path: &Path) -> CoreResult<LegacyArchive> {
    let bytes = std::fs::read(path)?;
    let metadata = legacy_metadata(&bytes)?;
    Ok(LegacyArchive {
        path: path.to_path_buf(),
        metadata,
        archive_bytes: bytes.len() as u64,
    })
}

/// Inspects an archive of either format from disk.
pub fn inspect_archive(path: &Path) -> CoreResult<Archive> {
    let bytes = std::fs::read(path)?;
    let archive_bytes = bytes.len() as u64;
    match inspect_bytes(&bytes)? {
        ArchiveKind::Container => {
            let backup = parse_archive(&bytes)?;
            Ok(Archive::Container(BackupFile {
                path: path.to_path_buf(),
                metadata: backup.metadata,
                archive_bytes,
            }))
        }
        ArchiveKind::LegacyJson => Ok(Archive::Legacy(LegacyArchive {
            path: path.to_path_buf(),
            metadata: legacy_metadata(&bytes)?,
            archive_bytes,
        })),
    }
}

/// Lists every archive in `folder`, newest first.
///
/// Both `.socdofbak` containers and `.socdof.json` documents are returned; files that are neither
/// or that fail validation are skipped, so a stray file never hides the valid backups.
pub fn list_archives(folder: &Path) -> CoreResult<Vec<Archive>> {
    if !folder.exists() {
        return Ok(Vec::new());
    }

    let mut archives = Vec::new();
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        let native = path.extension().and_then(|value| value.to_str()) == Some("socdofbak");
        if !native && !is_legacy_path(&path) {
            continue;
        }
        if let Ok(archive) = inspect_archive(&path) {
            archives.push(archive);
        }
    }

    archives.sort_by(|left, right| {
        right
            .created_at()
            .cmp(&left.created_at())
            .then_with(|| left.path().cmp(right.path()))
    });
    Ok(archives)
}

/// Restores an archive of either format into `database`.
///
/// A container replaces the database file atomically, as [`restore_backup`] does. A legacy document
/// is imported through [`legacy::import_json`] into the database, so its contacts and products
/// become live records and its invoices stay preserved in the raw document.
pub fn restore_archive(archive: &Path, database: &Path) -> CoreResult<Restore> {
    let bytes = std::fs::read(archive)?;
    match inspect_bytes(&bytes)? {
        ArchiveKind::Container => Ok(Restore::Container(restore_backup(archive, database)?)),
        ArchiveKind::LegacyJson => {
            if let Some(parent) = database.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let metadata = legacy_metadata(&bytes)?;
            let store = Store::open(database)?;
            let report = legacy::import_json(&store, &bytes)?;
            Ok(Restore::Legacy { metadata, report })
        }
    }
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

fn array_len(value: Option<&Value>) -> usize {
    value.and_then(Value::as_array).map_or(0, Vec::len)
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
        let listed = list_backups(&dir).expect("listed");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].path, archive);
        assert_eq!(listed[0].metadata, info.metadata);

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
    fn removes_stale_wal_and_shm_sidecars() {
        let dir = temp_dir("wal");
        let database = dir.join("socdof.db");
        let archive = dir.join("backup.socdofbak");

        {
            let store = Store::open(&database).expect("store");
            let mut contact = Contact::new(ContactKind::Company, now_millis());
            contact.company_name = Some("Wal Reste".to_string());
            store.insert_contact(&contact).expect("contact inserted");
            create_backup(&store, &archive, "0.1.0", now_millis()).expect("backup created");
        }

        // Leftovers of a writer that was killed while the database was in WAL mode.
        std::fs::write(dir.join("socdof.db-wal"), b"stale wal").expect("wal leftover");
        std::fs::write(dir.join("socdof.db-shm"), b"stale shm").expect("shm leftover");

        restore_backup(&archive, &database).expect("restored");

        assert!(!dir.join("socdof.db-wal").exists());
        assert!(!dir.join("socdof.db-shm").exists());

        let store = Store::open(&database).expect("store reopened");
        assert_eq!(store.contact_count().expect("contacts"), 1);
        assert_eq!(
            store.schema_version().expect("version"),
            crate::store::SCHEMA_VERSION
        );

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

    #[test]
    fn reads_the_legacy_header_from_the_document() {
        let document = br#"{
            "app": "SOCDOF_Enterprise_Local_ERP",
            "version": 2,
            "exported_at": "2026-11-07T12:00:00.000Z",
            "backup_owner": "Yuri",
            "data_summary": { "contacts_count": 99 },
            "contacts": [{}],
            "products": [],
            "invoices": [{}, {}],
            "purchase_orders": [{}]
        }"#;

        let metadata = legacy_metadata(document).expect("header");
        assert_eq!(metadata.document_version, 2);
        assert_eq!(metadata.owner, "Yuri");
        assert_eq!(metadata.created_at, 1_794_052_800_000);
        // Counts follow the arrays, not the (deliberately wrong) summary.
        assert_eq!(metadata.contacts, 1);
        assert_eq!(metadata.products, 0);
        assert_eq!(metadata.invoices, 2);
        assert_eq!(metadata.purchases, 1);
        assert_eq!(
            inspect_bytes(document).expect("kind"),
            ArchiveKind::LegacyJson
        );
        assert!(is_legacy_path(Path::new("socdof-2026-11-07.socdof.json")));
        assert!(!is_legacy_path(Path::new("socdof-2026-11-07.socdofbak")));
    }
}
