//! Contact persons through the desktop command layer.
//!
//! The Tauri commands are one-line adapters over [`DesktopState`], so this test exercises the exact
//! path the window uses: a form that carries persons, a client that does not manage them (absent
//! field keeps the stored list) and a client that removes every person.

use std::path::PathBuf;

use socdof_app::desktop::{ContactInput, ContactPersonInput, DesktopState};

fn scratch() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("socdof-app-persons-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

fn company() -> ContactInput {
    ContactInput {
        name: "AlpenTech Solutions AG".to_string(),
        company: "AlpenTech Solutions AG".to_string(),
        is_company: true,
        contact_type: "customer".to_string(),
        ..ContactInput::default()
    }
}

fn anna() -> ContactPersonInput {
    ContactPersonInput {
        first_name: " Anna ".to_string(),
        last_name: " Weber ".to_string(),
        email: " anna@example.com ".to_string(),
        role: "Einkauf".to_string(),
        is_primary: true,
        ..ContactPersonInput::default()
    }
}

#[test]
fn keeps_clears_and_restores_contact_persons() {
    let dir = scratch();
    let state = DesktopState::open(dir.join("socdof.db")).expect("desktop state");

    let mut form = company();
    form.contact_persons = Some(vec![anna()]);
    let created = state.create_contact(&form).expect("create contact");
    assert_eq!(created.contact_persons.len(), 1);
    assert!(
        created.contact_persons[0].id.starts_with("cp_"),
        "a new person gets a legacy-shaped id: {}",
        created.contact_persons[0].id
    );
    assert_eq!(created.contact_persons[0].first_name, "Anna");
    assert_eq!(
        created.contact_person_summary().as_deref(),
        Some("Anna Weber (Einkauf)")
    );

    // A client that does not send the field keeps the stored persons instead of deleting them.
    let absent = company();
    let updated = state
        .update_contact(created.id, &absent)
        .expect("update contact");
    assert_eq!(
        updated.contact_persons.len(),
        1,
        "absent field keeps persons"
    );

    // An explicit empty list removes them.
    let mut cleared = company();
    cleared.contact_persons = Some(Vec::new());
    let cleared = state
        .update_contact(created.id, &cleared)
        .expect("update contact");
    assert!(cleared.contact_persons.is_empty());

    // And the persons come back through the ordinary form submit.
    let mut again = company();
    again.contact_persons = Some(vec![anna()]);
    let restored = state
        .update_contact(created.id, &again)
        .expect("update contact");
    assert_eq!(restored.contact_persons.len(), 1);
    assert!(restored.contact_persons[0].is_primary);

    let listed = state.contacts(None).expect("list contacts");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].contact_persons, restored.contact_persons);

    std::fs::remove_dir_all(&dir).ok();
}
