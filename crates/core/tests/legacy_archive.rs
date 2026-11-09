//! Archive path tests: native container and legacy `.socdof.json` document share one surface.

use std::path::{Path, PathBuf};

use socdof_core::backup::{self, Archive, ArchiveKind, Restore};
use socdof_core::error::CoreError;
use socdof_core::legacy;
use socdof_core::store::Store;

const FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json"
);

fn temp_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "socdof-archive-{tag}-{}-{}",
        std::process::id(),
        socdof_core::now_millis()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn legacy_metadata_of(archive: &Archive) -> &backup::LegacyMetadata {
    match archive {
        Archive::Legacy(file) => &file.metadata,
        Archive::Container(_) => panic!("expected a legacy archive"),
    }
}

fn code_of(path: &Path) -> String {
    match backup::inspect_archive(path) {
        Err(CoreError::Validation(code)) => code,
        Err(other) => panic!("expected a validation error, got {other}"),
        Ok(archive) => panic!(
            "expected a validation error, got {}",
            archive.kind().as_str()
        ),
    }
}

#[test]
fn reads_the_archive_the_legacy_application_writes() {
    let archive = backup::inspect_archive(Path::new(FIXTURE)).expect("inspect");
    assert_eq!(archive.kind(), ArchiveKind::LegacyJson);
    assert_eq!(archive.path(), Path::new(FIXTURE));
    assert_eq!(archive.archive_bytes(), {
        std::fs::metadata(FIXTURE).expect("fixture").len()
    });

    let metadata = legacy_metadata_of(&archive);
    assert_eq!(metadata.app, legacy::LEGACY_APP);
    assert_eq!(metadata.document_version, 2);
    assert!(!metadata.owner.trim().is_empty(), "owner is missing");
    assert!(
        metadata.created_at > 1_700_000_000_000,
        "exported_at was not parsed: {}",
        metadata.created_at
    );
    // Counts of the real fixture, read from its arrays.
    assert_eq!(metadata.contacts, 3);
    assert_eq!(metadata.products, 2);
    assert_eq!(metadata.invoices, 1);
    assert_eq!(metadata.purchases, 1);
}

#[test]
fn restores_a_legacy_archive_into_a_new_database() {
    let dir = temp_dir("restore");
    let database = dir.join("restored.db");

    let restore = backup::restore_archive(Path::new(FIXTURE), &database).expect("restore");
    let (metadata, report) = match restore {
        Restore::Legacy { metadata, report } => (metadata, report),
        Restore::Container(_) => panic!("expected a legacy restore"),
    };
    assert_eq!(
        (report.contacts, report.products, report.invoices),
        (metadata.contacts, metadata.products, metadata.invoices)
    );
    assert_eq!(
        (report.contacts, report.products, report.invoices),
        (3, 2, 1)
    );

    let store = Store::open(&database).expect("store");
    assert_eq!(store.contact_count().expect("contacts"), 3);
    assert_eq!(store.product_count().expect("products"), 2);

    // The legacy invoices are not native rows yet, but the document keeps them for export.
    let exported = legacy::build_export(&store).expect("export");
    assert_eq!(exported["invoices"].as_array().map(Vec::len), Some(1));

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn roundtrips_an_archive_through_a_second_database() {
    let dir = temp_dir("roundtrip");
    let first = dir.join("first.db");
    let archive = dir.join("socdof-2026-11-07.socdof.json");
    let second = dir.join("second.db");

    let store = Store::open(&first).expect("store");
    legacy::import(&store, Path::new(FIXTURE)).expect("import");
    legacy::export(&store, &archive).expect("export");

    let written = backup::read_legacy_archive(&archive).expect("header");
    assert_eq!(written.metadata.document_version, 2);
    assert_eq!(written.metadata.contacts, 3);
    assert_eq!(written.archive_bytes, {
        std::fs::metadata(&archive).expect("archive").len()
    });

    backup::restore_archive(&archive, &second).expect("restore");
    let restored = Store::open(&second).expect("store");

    let left = legacy::build_export(&store).expect("export");
    let right = legacy::build_export(&restored).expect("export");
    for key in [
        "app",
        "version",
        "contacts",
        "products",
        "stock_moves",
        "invoices",
        "purchase_orders",
        "pos_orders",
        "chatter_messages",
        "settings",
    ] {
        assert_eq!(left[key], right[key], "changed {key}");
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn lists_containers_and_legacy_archives_newest_first() {
    let dir = temp_dir("list");
    let native = dir.join("native.socdofbak");
    {
        let store = Store::open(dir.join("source.db")).expect("store");
        backup::create_backup(&store, &native, "0.1.0", 1_700_000_000_000).expect("container");
    }
    std::fs::copy(FIXTURE, dir.join("legacy.socdof.json")).expect("fixture copy");
    std::fs::write(dir.join("broken.socdofbak"), b"not a container").expect("broken");
    std::fs::write(dir.join("notes.txt"), b"ignore me").expect("notes");

    let archives = backup::list_archives(&dir).expect("list");
    assert_eq!(archives.len(), 2, "{archives:?}");
    assert_eq!(archives[0].kind(), ArchiveKind::LegacyJson);
    assert!(
        archives[0].created_at() > archives[1].created_at(),
        "newest archive is not first"
    );
    assert_eq!(archives[1].kind(), ArchiveKind::Container);

    // The container restores through the same entry point.
    let database = dir.join("restored.db");
    match backup::restore_archive(&native, &database).expect("restore") {
        Restore::Container(metadata) => assert_eq!(metadata.created_at, 1_700_000_000_000),
        Restore::Legacy { .. } => panic!("expected the native container"),
    }

    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn broken_foreign_and_foreign_version_archives_are_typed_errors() {
    let dir = temp_dir("broken");
    let path = dir.join("candidate.bin");
    let database = dir.join("untouched.db");

    let cases: [(&[u8], &str); 8] = [
        (b"", "backup_truncated"),
        (b"   \n\t ", "backup_truncated"),
        (b"PK\x03\x04rest-of-a-zip", "backup_invalid_format"),
        (b"[1, 2, 3]", "backup_invalid_format"),
        (
            br#"{"app":"OTHER","version":2,"contacts":[],"products":[],"invoices":[]}"#,
            "backup_invalid_format",
        ),
        (
            br#"{"app":"SOCDOF_Enterprise_Local_ERP","version":9,"contacts":[],"products":[],"invoices":[]}"#,
            "backup_unsupported_version",
        ),
        (
            br#"{"app":"SOCDOF_Enterprise_Local_ERP","version":2,"exported_at":"yesterday","contacts":[],"products":[],"invoices":[]}"#,
            "backup_corrupt",
        ),
        (
            br#"{"app":"SOCDOF_Enterprise_Local_ERP","contacts":["#,
            "backup_invalid_format",
        ),
    ];

    for (bytes, expected) in cases {
        std::fs::write(&path, bytes).expect("write");
        assert_eq!(
            code_of(&path),
            expected,
            "bytes: {}",
            String::from_utf8_lossy(bytes)
        );
        assert!(
            backup::restore_archive(&path, &database).is_err(),
            "restore accepted: {}",
            String::from_utf8_lossy(bytes)
        );
        assert!(!database.exists(), "rejected archive created a database");
    }

    // A truncated container is rejected before anything is written.
    std::fs::write(&path, b"SOCDOFBK\x01\x00").expect("write");
    assert_eq!(code_of(&path), "backup_truncated");
    let error = backup::restore_archive(&path, &database).expect_err("truncated");
    assert!(matches!(error, CoreError::Validation(code) if code == "backup_truncated"));
    assert!(!database.exists());

    let _ = std::fs::remove_dir_all(dir);
}
