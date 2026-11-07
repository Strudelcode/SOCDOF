//! Command-layer proof for the Tauri screen: schema version and backup through [`DesktopState`].
//!
//! The Tauri crate only adapts these methods to `invoke` handlers, so this test runs without
//! GTK/WebKit and still exercises the exact code path the window uses.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::DesktopState;
use socdof_app::shell::Paths;
use socdof_core::error::CoreError;
use socdof_core::store::SCHEMA_VERSION;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-desktop-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

#[test]
fn desktop_commands_report_schema_and_write_backup() {
    let dir = temp_dir("commands");
    let database = dir.join("socdof.db");
    let state = DesktopState::open(database.clone()).expect("desktop state opens");

    let status = state.status().expect("status command");
    assert_eq!(status.database, database);
    assert_eq!(status.schema_version, SCHEMA_VERSION);
    assert_eq!(status.contacts, 0);
    assert_eq!(status.products, 0);
    assert_eq!(status.invoices, 0);
    assert_eq!(status.users, 0);
    assert_eq!(status.lock_owner_pid, Some(std::process::id()));

    // A second session cannot take the lock the state holds.
    assert!(matches!(
        DesktopState::open(database.clone()),
        Err(CoreError::Validation(code)) if code == "lock_busy"
    ));

    let report = state.backup(None).expect("backup command");
    assert!(report.path.starts_with(dir.join("backups")));
    assert!(report.path.exists(), "backup file exists");
    assert!(report.bytes > report.database_bytes);
    assert_eq!(report.schema_version, SCHEMA_VERSION);

    let archive = std::fs::read(&report.path).expect("backup readable");
    assert!(
        archive.starts_with(b"SOCDOFBK"),
        "archive uses the core container format"
    );

    let explicit = dir.join("explicit.socdofbak");
    let explicit_report = state
        .backup(Some(Path::new(&explicit)))
        .expect("backup to explicit path");
    assert_eq!(explicit_report.path, explicit);
    assert!(explicit.exists());

    let lock = Paths::new(database.clone()).lock;
    assert!(lock.exists(), "state keeps the instance lock");
    drop(state);
    assert!(!lock.exists(), "dropping the state releases the lock");

    let _ = std::fs::remove_dir_all(dir);
}
