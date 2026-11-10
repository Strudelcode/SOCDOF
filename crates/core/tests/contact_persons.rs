//! Contact persons ("sub-contacts") through storage, search and the legacy document.
//!
//! The shape and the rules come from `SOCDOF - TS`: a company carries its persons as
//! `contact_persons`, the first one is primary, person names are searchable, and the legacy
//! `.socdof.json` backup keeps the array on the contact.

use std::path::PathBuf;

use socdof_core::domain::contact::{Contact, ContactKind, ContactPerson};
use socdof_core::legacy;
use socdof_core::store::Store;

fn person(id: &str, first: &str, last: &str, role: &str, primary: bool) -> ContactPerson {
    let mut person = ContactPerson::draft(id.to_string(), primary);
    person.first_name = first.to_string();
    person.last_name = last.to_string();
    person.role = role.to_string();
    person
}

fn company_with_persons() -> Contact {
    let mut contact = Contact::new(ContactKind::Company, 1_700_000_000_000);
    contact.company_name = Some("AlpenTech Solutions AG".to_string());
    contact.name = Some("AlpenTech Solutions AG".to_string());
    contact.contact_persons = vec![
        person("cp_1", "Anna", "Weber", "Einkauf", true),
        person("cp_2", "Ben", "Klein", "Vertrieb", false),
    ];
    contact
}

#[test]
fn stores_persons_in_order_and_loads_them_back() {
    let store = Store::open_in_memory().expect("store");
    let contact = company_with_persons();
    store.insert_contact(&contact).expect("insert");

    let loaded = store
        .find_contact(contact.id)
        .expect("find")
        .expect("contact");
    assert_eq!(loaded.contact_persons.len(), 2);
    assert_eq!(loaded.contact_persons[0].id, "cp_1");
    assert_eq!(loaded.contact_persons[0].summary(), "Anna Weber (Einkauf)");
    assert!(loaded.contact_persons[0].is_primary);
    assert_eq!(loaded.contact_persons[1].id, "cp_2");
    assert!(!loaded.contact_persons[1].is_primary);

    // The list and the single lookup agree, which the legacy app relies on for its badges.
    let listed = store.list_contacts().expect("list");
    assert_eq!(listed[0].contact_persons, loaded.contact_persons);
    assert_eq!(
        listed[0].contact_person_summary().as_deref(),
        Some("Anna Weber (Einkauf)")
    );

    // Replacing the persons on save keeps the order of the new list.
    let mut edited = loaded.clone();
    edited.contact_persons.reverse();
    edited.ensure_single_primary_contact_person();
    store.update_contact(&edited).expect("update");
    let reloaded = store
        .find_contact(contact.id)
        .expect("find")
        .expect("contact");
    assert_eq!(reloaded.contact_persons[0].id, "cp_2");
    assert_eq!(reloaded.contact_persons.len(), 2);
}

#[test]
fn deleting_a_contact_removes_its_persons() {
    let store = Store::open_in_memory().expect("store");
    let contact = company_with_persons();
    store.insert_contact(&contact).expect("insert");

    store.delete_contact(contact.id).expect("delete");
    assert!(store.find_contact(contact.id).expect("find").is_none());
    assert!(store.list_contacts().expect("list").is_empty());
}

#[test]
fn searches_contact_persons_like_the_legacy_app() {
    let store = Store::open_in_memory().expect("store");
    store
        .insert_contact(&company_with_persons())
        .expect("insert");

    let by_first_name = store.search_contacts("anna").expect("search");
    assert_eq!(by_first_name.len(), 1, "the person's first name matches");
    let by_role = store.search_contacts("vertrieb").expect("search");
    assert_eq!(by_role.len(), 1, "the person's role matches");
    let by_company = store.search_contacts("alpentech").expect("search");
    assert_eq!(by_company.len(), 1, "the contact itself still matches");
    assert!(store.search_contacts("niemand").expect("search").is_empty());
}

#[test]
fn the_legacy_document_carries_contact_persons() {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/legacy/SOCDOF_Legacy_Backup_2026-11-07.socdof.json");
    let store = Store::open_in_memory().expect("store");
    legacy::import(&store, &fixture).expect("import");

    let contacts = store.list_contacts().expect("list");
    let company = contacts
        .iter()
        .find(|contact| contact.legacy_id == Some(1))
        .expect("fixture contact");
    assert_eq!(company.contact_persons.len(), 1);
    let person = &company.contact_persons[0];
    assert_eq!(person.id, "cp-1");
    assert_eq!(person.first_name, "Florian");
    assert_eq!(person.last_name, "Weber");
    assert_eq!(person.email, "f.weber@alpentech.ch");
    assert_eq!(person.phone, "+41 44 987 6543");
    assert_eq!(person.role, "Geschäftsführer");
    assert!(person.is_primary);
    assert_eq!(person.summary(), "Florian Weber (Geschäftsführer)");

    // A write → export round trip still carries the array, in the legacy field names.
    let directory = std::env::temp_dir().join(format!("socdof-persons-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).expect("dir");
    let archive = directory.join("export.socdof.json");
    legacy::export(&store, &archive).expect("export");

    let document: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&archive).expect("read")).expect("json");
    let exported = document["contacts"]
        .as_array()
        .expect("contacts")
        .iter()
        .find(|contact| contact["id"] == 1)
        .expect("exported contact");
    let persons = exported["contact_persons"].as_array().expect("array");
    assert_eq!(persons.len(), 1);
    assert_eq!(persons[0]["first_name"], "Florian");
    assert_eq!(persons[0]["last_name"], "Weber");
    assert_eq!(persons[0]["is_primary"], true);
    assert_eq!(persons[0]["role"], "Geschäftsführer");

    std::fs::remove_dir_all(&directory).ok();
}
