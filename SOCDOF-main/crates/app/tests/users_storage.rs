//! Desktop-state proof for account management and the storage inspector.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{DesktopState, UserInput};
use socdof_core::error::CoreError;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-users-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn user_input(username: &str, password: &str, role: &str) -> UserInput {
    UserInput {
        id: None,
        username: username.to_string(),
        display_name: "Test Account".to_string(),
        role: role.to_string(),
        active: true,
        password: password.to_string(),
    }
}

#[test]
fn creates_logs_in_updates_and_deletes_an_account() {
    let dir = temp_dir("accounts");
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state opens");

    let created = state
        .save_user(&user_input("admin.test", "correct horse", "admin"))
        .expect("create account");
    assert_eq!(created.username, "admin.test");
    assert_eq!(created.role, "admin");
    assert!(state
        .users()
        .expect("list")
        .iter()
        .any(|user| user.id == created.id));

    assert!(matches!(
        state.login_user("admin.test", "wrong password"),
        Err(CoreError::Validation(code)) if code == "invalid_credentials"
    ));
    let signed_in = state
        .login_user("admin.test", "correct horse")
        .expect("login");
    assert_eq!(signed_in.id, created.id);

    let second = state
        .save_user(&user_input("second.admin", "correct horse", "admin"))
        .expect("second admin");
    let mut update = user_input("admin.test", "", "user");
    update.id = Some(created.id);
    update.display_name = "Changed Name".to_string();
    let updated = state.save_user(&update).expect("update account");
    assert_eq!(updated.display_name, "Changed Name");
    assert_eq!(updated.role, "user");
    assert!(state.login_user("admin.test", "correct horse").is_ok());

    state.delete_user(created.id).expect("delete account");
    assert!(
        state.delete_user(second.id).is_err(),
        "the last admin is protected"
    );
    assert_eq!(state.users().expect("list").len(), 1);

    state.release_lock();
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn storage_inspector_reports_database_and_counts() {
    let dir = temp_dir("storage");
    let path = dir.join("socdof.db");
    let state = DesktopState::open(&path).expect("desktop state opens");
    let inspector = state.storage_inspector().expect("storage inspector");

    assert_eq!(inspector.database, path);
    assert!(inspector.database_bytes > 0);
    assert_eq!(inspector.schema_version, socdof_core::store::SCHEMA_VERSION);
    assert!(inspector
        .counts
        .iter()
        .any(|row| row.name == "contacts" && row.rows == 0));
    assert!(inspector.backup_folder.ends_with("backups"));

    state.release_lock();
    let _ = std::fs::remove_dir_all(dir);
}
