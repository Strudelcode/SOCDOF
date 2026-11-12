//! Desktop-state proof for the settings backup list and the Textwerk documents.
//!
//! The Tauri command layer only forwards these methods, so this test exercises the same SQLite and
//! archive code paths without GTK/WebKit.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{DesktopState, DocumentInput};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-documents-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

#[test]
fn documents_roundtrip_update_search_and_delete() {
    let dir = temp_dir("roundtrip");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");
    assert!(state.documents().expect("documents list").is_empty());

    let created = state
        .save_document(&DocumentInput {
            id: None,
            name: "Notizen".to_string(),
            body: "Erster Absatz".to_string(),
        })
        .expect("document is created");
    assert_eq!(created.name, "Notizen");
    assert_eq!(state.documents().expect("documents list").len(), 1);

    let updated = state
        .save_document(&DocumentInput {
            id: Some(created.id),
            name: "Notizen".to_string(),
            body: "Erster Absatz\nZweiter Absatz".to_string(),
        })
        .expect("document is updated");
    assert_eq!(updated.id, created.id);
    assert!(updated.body.contains("Zweiter"));
    assert_eq!(state.documents().expect("documents list").len(), 1);

    state
        .delete_document(created.id)
        .expect("document is deleted");
    assert!(state.documents().expect("documents list").is_empty());
}

#[test]
fn company_profile_and_backup_list_share_the_configured_folder() {
    let dir = temp_dir("backup");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let mut profile = state.company_profile().expect("default profile");
    profile.name = "Testwerk GmbH".to_string();
    profile.currency = "EUR".to_string();
    let folder = dir.join("backups");
    profile.backup_folder_path = folder.to_string_lossy().into_owned();
    state
        .save_company_profile(&profile)
        .expect("profile is saved");

    let report = state
        .save_backup_to(&folder.join("manual.socdofbak"))
        .expect("backup is written");
    assert!(report.bytes > 0);
    assert!(folder.join("manual.socdofbak").exists());

    let files = state.backup_files().expect("backup list");
    assert_eq!(files.len(), 1);
    assert_eq!(
        files[0].path,
        folder.join("manual.socdofbak").to_string_lossy()
    );
    assert!(files[0].bytes > 0);
}
